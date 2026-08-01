// 손글씨 노트 스타일 카드를 이미지로 생성한다 (Nano Banana Pro).
//
// 왜 이미지 생성인가: CSS로는 손글씨 필압·테이프·포스트잇 질감이 안 나온다.
// 왜 Pro만 쓰는가: 일반 이미지 모델은 한글을 심하게 틀린다. 실제 테스트에서
//   "래미안안양 메가트리아" → "래메안안양 메가타리마",
//   "실거주 만족도 높은 단지" → "실겨구 살작두 많도 늪은 단지" 로 나왔다.
//   시세를 다루는 계정에서 이건 사고라 Pro가 아니면 쓰지 않는다.
// 안전장치: 생성 후 비전 모델로 다시 읽어 숫자·단지명이 그대로인지 대조한다.

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

// Pro가 혼잡할 때가 잦아서(실측 3회 중 1회 실패) 순서대로 시도한다.
const IMAGE_MODELS = ['gemini-3-pro-image', 'gemini-3-pro-image-preview'];
const VISION_MODEL = 'gemini-2.5-flash';

export type NotebookFacts = {
  index: number;          // 1부터
  dong: string;           // 안양동
  name: string;           // 래미안안양 메가트리아
  region: string;         // 안양시 만안구 안양동
  pyeong?: string;        // 전용 18평
  price?: string;         // 5억 6,000만 원
  built?: string;         // 2016년식
  advantages: string[];
  memo?: string;
  noteLabel: string;      // 임장 메모
  noteNumber: string;     // No.006
  ratio: string;          // '4:5' 등
};

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

export function buildNotebookPrompt(f: NotebookFacts): string {
  const rows = [
    f.region && `  📍 ${f.region}`,
    f.pyeong && `  🏠 ${f.pyeong}`,
    f.price && `  ₩ ${f.price}   ← 이 값만 노란 형광펜으로 강조하고 빨간 글씨로 크게`,
    f.built && `  📅 ${f.built}`,
  ].filter(Boolean).join('\n');

  return `한국 부동산 인스타그램 카드뉴스를 **손글씨 스프링 노트** 스타일 이미지로 그려주세요. 비율 ${f.ratio} 세로.

[배경]
- 화면 전체가 크림색 줄노트 종이, 옅은 가로 줄
- 왼쪽 가장자리에 검은 스프링 제본 링(사실적으로)
- 스프링 오른쪽에 얇은 빨간 세로 여백선
- 실제 노트를 사진 찍은 듯한 종이 질감과 부드러운 그림자

[내용 — 아래 한글과 숫자를 한 글자도 바꾸지 말고 그대로 쓸 것]
- 좌측 상단: 빨간 손그림 동그라미 안에 "${f.index}", 옆에 노란 형광펜으로 칠한 "${f.dong}", 작은 빨간 별
- 그 아래 큰 손글씨 제목: "${f.name}" — 빨간 펜으로 물결 밑줄
- 손그림 테두리 정보 상자:
${rows}
- 아래에 빨간 "👍 장점" 제목과 빨간 밑줄, 그 아래 체크 항목들
  (각 줄: 빨간 손그림 ☑ 체크박스 + 노란 형광펜으로 칠한 손글씨)
${f.advantages.map(a => `  ☑ ${a}`).join('\n')}
${f.memo ? `- 오른쪽: 살짝 기울어진 노란 포스트잇, 빨간 압정으로 고정, 제목 "${f.noteLabel}"에 밑줄, 본문 "${f.memo}", 작은 웃는 얼굴` : ''}
- 우측 하단: 빨간 클립으로 집은 크라프트 종이 태그. 위에 "임장노트", 아래에 빨간 손글씨로 크게 "${f.noteNumber}"
- 좌측 하단: 파란 선으로 그린 간단한 도시 스카이라인, 작은 나무와 구름

[스타일]
- 전부 펜과 마커로 직접 쓴 느낌. 한글 손글씨, 살짝 불규칙한 획
- 본문 검정, 강조·밑줄·별 빨강, 낙서 파랑, 형광펜 노랑
- 여백을 넉넉히 두고 가장자리에서 글자가 잘리지 않게
- 위에 적힌 것 외의 영어는 넣지 말 것

[가장 중요]
- 위의 모든 한글 단어와 숫자를 정확히 그대로 재현할 것.
- 위에 없는 정보(지하철역 이름, 도보 시간, 학군, 세대수, 브랜드 순위)는 절대 만들어 넣지 말 것.`;
}

async function callImageModel(key: string, model: string, prompt: string): Promise<string | null> {
  const res = await fetch(`${API}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${model} ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.find((p: any) => p.inlineData)?.inlineData?.data ?? null;
}

/** 생성된 카드 이미지를 다시 읽어, 반드시 들어가야 할 문구가 그대로 있는지 확인 */
export async function verifyCardText(
  key: string,
  imageBase64: string,
  mustContain: string[]
): Promise<{ ok: boolean; missing: string[]; read: string }> {
  try {
    const res = await fetch(`${API}/${VISION_MODEL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: 'image/png', data: imageBase64 } },
            { text: '이 이미지에 적힌 모든 한글과 숫자를 있는 그대로 옮겨 적어주세요. 설명 없이 텍스트만, 줄바꿈으로 구분해서.' },
          ],
        }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return { ok: true, missing: [], read: '' }; // 검증 실패는 통과 처리(생성을 막지 않음)

    const data = await res.json();
    const read: string = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join(' ') || '';
    const flat = read.replace(/\s/g, '');
    const missing = mustContain.filter(m => m && !flat.includes(m.replace(/\s/g, '')));
    return { ok: missing.length === 0, missing, read };
  } catch {
    return { ok: true, missing: [], read: '' };
  }
}

export type NotebookImageResult = { base64: string; verified: boolean; note?: string };

/**
 * 노트 카드 이미지 생성. Pro가 혼잡하면 재시도하고,
 * 핵심 문구가 틀리게 나오면 다시 생성한다.
 * 끝내 실패하면 null → 호출부에서 CSS 렌더러로 폴백한다.
 *
 * 단지 카드와 뉴스 카드가 같은 재시도·검증 루프를 쓰도록 분리해 둔다.
 * 프롬프트만 다르고, "틀리면 안 되는 값을 다시 읽어 대조한다"는 원칙은 같다.
 */
export async function renderNotebookCard(
  prompt: string,
  mustContain: string[],
  opts?: { maxAttempts?: number; label?: string }
): Promise<NotebookImageResult | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const label = opts?.label || '카드';
  const maxAttempts = opts?.maxAttempts ?? 3;
  let lastError = '';
  let lastUnverified: { base64: string; missing: string[] } | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const model = IMAGE_MODELS[attempt % IMAGE_MODELS.length];
    try {
      const base64 = await callImageModel(key, model, prompt);
      if (!base64) { lastError = '이미지 없음'; continue; }

      const check = await verifyCardText(key, base64, mustContain);
      if (check.ok) return { base64, verified: true };

      lastUnverified = { base64, missing: check.missing };
      console.warn(`[NotebookImage] ${label} 검증 실패(시도 ${attempt + 1}): 누락/오탈자 ${check.missing.join(', ')}`);
    } catch (e: any) {
      lastError = e?.message || String(e);
      console.warn(`[NotebookImage] ${label} 생성 실패(시도 ${attempt + 1}): ${lastError}`);
      await new Promise(r => setTimeout(r, 2500));
    }
  }

  // 검증은 못 넘겼지만 그림은 나온 경우 — 사람이 눈으로 확인하도록 표시해서 넘긴다
  if (lastUnverified) {
    return {
      base64: lastUnverified.base64,
      verified: false,
      note: `카드에 적힌 문구 확인 필요 (${lastUnverified.missing.join(', ')})`,
    };
  }
  return null;
}

/** 단지 카드 — 가격·평형·연식이 틀리면 안 된다 */
export async function generateNotebookImage(
  facts: NotebookFacts,
  opts?: { maxAttempts?: number }
): Promise<NotebookImageResult | null> {
  return renderNotebookCard(
    buildNotebookPrompt(facts),
    [facts.name, facts.price, facts.pyeong, facts.built].filter(Boolean) as string[],
    { maxAttempts: opts?.maxAttempts, label: facts.name }
  );
}

export type NewsNotebookFacts = {
  index: number;        // 1부터
  category: string;     // 청약 / 분양가 / 공급 …
  headline: string;     // 카드 제목
  lead?: string;        // 한 문장 설명
  points: string[];     // 핵심 포인트 3~4개
  stat?: { value: string; label?: string };  // 대표 수치(있을 때만)
  source?: string;      // 출처: 연합뉴스
  noteLabel?: string;   // 태그에 적을 말 (기본: 오늘의 뉴스)
  noteNumber: string;   // No.012
  ratio: string;
};

/**
 * 뉴스 카드 — 단지 카드와 같은 노트 룩이지만 내용 구성이 다르다.
 * 검증 대상은 제목과 대표 수치. 수치를 틀리게 그리면 기사와 다른 정보가 나간다.
 */
export function buildNewsNotebookPrompt(f: NewsNotebookFacts): string {
  return `한국 부동산 뉴스 인스타그램 카드뉴스를 **손글씨 스프링 노트** 스타일 이미지로 그려주세요. 비율 ${f.ratio} 세로.

[배경]
- 화면 전체가 크림색 줄노트 종이, 옅은 가로 줄
- 왼쪽 가장자리에 검은 스프링 제본 링(사실적으로)
- 스프링 오른쪽에 얇은 빨간 세로 여백선
- 실제 노트를 사진 찍은 듯한 종이 질감과 부드러운 그림자

[내용 — 아래 한글과 숫자를 한 글자도 바꾸지 말고 그대로 쓸 것]
- 좌측 상단: 빨간 손그림 동그라미 안에 "${f.index}"${f.category ? `, 옆에 노란 형광펜으로 칠한 "${f.category}"` : ' (옆에 아무 글자도 넣지 말 것)'}
- 그 아래 큰 손글씨 제목: "${f.headline}" — 빨간 펜으로 물결 밑줄
${f.lead ? `- 제목 아래 작은 손글씨 한 줄: "${f.lead}"` : ''}
${f.stat ? `- 가운데에 손그림 테두리 상자. 안에 빨간 큰 손글씨로 "${f.stat.value}"${f.stat.label ? `, 그 아래 작게 "${f.stat.label}"` : ''}` : ''}
- 빨간 "✔ 핵심 포인트" 제목과 빨간 밑줄, 그 아래 체크 항목들
  (각 줄: 빨간 손그림 ☑ 체크박스 + 노란 형광펜으로 칠한 손글씨)
${f.points.map(p => `  ☑ ${p}`).join('\n')}
${f.source ? `- 우측 하단 작은 글씨: "${f.source}"` : ''}
- 우측 하단: 빨간 클립으로 집은 크라프트 종이 태그. 위에 "${f.noteLabel || '오늘의 뉴스'}", 아래에 빨간 손글씨로 크게 "${f.noteNumber}"
- 좌측 하단: 파란 선으로 그린 간단한 도시 스카이라인, 작은 나무와 구름

[스타일]
- 전부 펜과 마커로 직접 쓴 느낌. 한글 손글씨, 살짝 불규칙한 획
- 본문 검정, 강조·밑줄 빨강, 낙서 파랑, 형광펜 노랑
- 여백을 넉넉히 두고 가장자리에서 글자가 잘리지 않게
- 위에 적힌 것 외의 영어는 넣지 말 것

[가장 중요]
- 위의 모든 한글 단어와 숫자를 정확히 그대로 재현할 것.
- 위에 없는 정보(단지명, 분양가, 날짜, 지하철역, 세대수)는 절대 만들어 넣지 말 것.`;
}

export async function generateNewsNotebookImage(
  facts: NewsNotebookFacts,
  opts?: { maxAttempts?: number }
): Promise<NotebookImageResult | null> {
  // 제목은 길면 줄바꿈되어 OCR 대조가 흔들린다 → 앞부분과 대표 수치만 대조한다
  const mustContain = [facts.headline.slice(0, 8), facts.stat?.value].filter(Boolean) as string[];
  return renderNotebookCard(buildNewsNotebookPrompt(facts), mustContain, {
    maxAttempts: opts?.maxAttempts ?? 2,
    label: facts.headline,
  });
}
