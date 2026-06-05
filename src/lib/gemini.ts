import { GoogleGenerativeAI } from '@google/generative-ai';
import { callAI } from '@/lib/ai/openrouter';

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

  try {
    const result = await makeModel(PRIMARY_MODEL).generateContent(input);
    return result.response.text();
  } catch (primaryErr: unknown) {
    if (!is503(primaryErr) && !is429(primaryErr)) throw primaryErr;

    // 503 or 429: wait 5 s then retry with fallback model
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));

    try {
      const result = await makeModel(FALLBACK_MODEL).generateContent(input);
      return result.response.text();
    } catch (fallbackErr: unknown) {
      if (typeof input === 'string') {
        try {
          return await callAI({
            prompt: input,
            system: options.systemInstruction,
          });
        } catch {
          throw fallbackErr;
        }
      }
      throw fallbackErr;
    }
  }
}
