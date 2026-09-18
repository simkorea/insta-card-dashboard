import { GoogleGenerativeAI } from '@google/generative-ai';
import { callAI, callGroq } from '@/lib/ai/openrouter';

const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';
const RETRY_DELAY_MS = 5000;

function is503(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '');
  return (
    msg.includes('503') ||
    msg.includes('Service Unavailable') ||
    msg.includes('high demand')
  );
}

function is429(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '');
  return msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED');
}

/**
 * 잔여 한도가 아예 없는 경우인지.
 *
 * 같은 429라도 성격이 다르다. 초당 요청이 몰려 밀린 것이면 잠깐 기다렸다
 * 다시 부르면 되지만, 월 결제 한도나 쿼터가 바닥난 것이면 기다려도 안 된다.
 * 두 번째 모델(flash-lite)도 같은 프로젝트 한도를 쓰므로 함께 막혀 있다.
 *
 * 이걸 구분하지 않아서 캡션 생성이 죽었다 — 5초 기다렸다 어차피 막힌 모델을
 * 한 번 더 부르느라 라우트 제한(30초)을 넘겨 '잠시 후 다시 시도해주세요'만
 * 떴다. 실제로는 OpenRouter로 넘어갔으면 됐을 상황이었다.
 */
function isQuotaExhausted(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '');
  return /spending cap|exceeded your current quota|quota.*exceed|billing/i.test(msg);
}

export function toKoreanError(err: unknown): string {
  const msg = String((err as any)?.message ?? err ?? '');
  if (is503(err)) {
    return 'AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.';
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
    return 'AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
  }
  if (msg.includes('DEADLINE_EXCEEDED') || msg.includes('timeout')) {
    return '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
  }
  if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
    return '요청 내용을 확인해주세요.';
  }
  if (err instanceof SyntaxError || msg.includes('SyntaxError') || msg.includes('JSON')) {
    return 'AI 생성 결과가 불완전하게 반환되었습니다. 글자 수를 조금 줄이거나 다시 시도해주세요.';
  }
  return 'AI 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

// 자동 경로용 AI 호출: OpenRouter 의 지정 모델(예: haiku) → Gemini → Groq.
//
// 2026-09-18 아침 카드뉴스 초안이 통째로 빠졌다. OpenRouter 크레딧($5)이
// 바닥나 haiku 호출이 402 로 두 번 다 실패했기 때문이다. 혼자 도는 자동
// 경로는 한 공급자만 믿으면 그날이 빈다 — 막히면 다음 공급자로 간다.
// 마지막 Groq 는 무료 등급이라 셋 다 돈이 떨어져도 하루는 채운다.
//
// Gemini 2.5 는 생각(thinking) 토큰도 출력 한도에서 빠진다. 한도를 넉넉히
// 주고 생각은 끈다 — 안 그러면 긴 JSON 이 중간에 잘린다.
export async function callWithFallback(opts: {
  prompt: string;
  model: string;
  system?: string;
  maxTokens?: number;
  json?: boolean;
}): Promise<string> {
  const errors: string[] = [];
  const fail = (who: string, e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`${who}: ${msg.slice(0, 200)}`);
    console.warn(`[AI] ${who} 실패 → 다음 공급자로: ${msg.slice(0, 200)}`);
  };

  try {
    return await callAI(opts);
  } catch (e) { fail(opts.model, e); }

  try {
    return await generateWithRetry(opts.prompt, {
      systemInstruction: opts.system,
      generationConfig: {
        maxOutputTokens: Math.max(16384, (opts.maxTokens ?? 0) * 2),
        thinkingConfig: { thinkingBudget: 0 },
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    });
  } catch (e) { fail('Gemini', e); }

  try {
    return await callGroq({ prompt: opts.prompt, system: opts.system, maxTokens: opts.maxTokens, jsonMode: opts.json });
  } catch (e) { fail('Groq', e); }

  throw new Error(`AI 공급자 셋 다 실패 — ${errors.join(' / ')}`);
}

// Accepts the same input types as model.generateContent():
// - string (text prompt)
// - object with contents array (vision/structured)
// - array of parts (mixed text + image)
export async function generateWithRetry(
  input: Parameters<ReturnType<GoogleGenerativeAI['getGenerativeModel']>['generateContent']>[0],
  options: { systemInstruction?: string; generationConfig?: any; tools?: any } = {}
): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  const makeModel = (modelName: string) =>
    genAI.getGenerativeModel({
      model: modelName,
      ...(options.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
      ...(options.tools ? { tools: options.tools } : {}),
      generationConfig: options.generationConfig,
    });

  // 프롬프트가 문자열일 때만 OpenRouter로 넘길 수 있다 (이미지 등은 못 넘긴다)
  const toOpenRouter = async () =>
    typeof input === 'string'
      ? callAI({ prompt: input, system: options.systemInstruction })
      : Promise.reject(new Error('문자열 프롬프트가 아니어서 대체 모델로 넘길 수 없습니다'));

  try {
    const result = await makeModel(PRIMARY_MODEL).generateContent(input);
    return result.response.text();
  } catch (primaryErr: unknown) {
    if (!is503(primaryErr) && !is429(primaryErr)) throw primaryErr;

    // 한도가 바닥난 경우엔 기다리지도, 같은 한도를 쓰는 모델을 부르지도 않는다.
    // 곧장 다른 공급자로 넘긴다 — 안 그러면 시간만 쓰고 라우트가 죽는다.
    if (isQuotaExhausted(primaryErr)) {
      try {
        return await toOpenRouter();
      } catch {
        throw primaryErr;
      }
    }

    // 503 or 429: wait 5 s then retry with fallback model
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));

    try {
      const result = await makeModel(FALLBACK_MODEL).generateContent(input);
      return result.response.text();
    } catch (fallbackErr: unknown) {
      try {
        return await toOpenRouter();
      } catch {
        throw fallbackErr;
      }
    }
  }
}
