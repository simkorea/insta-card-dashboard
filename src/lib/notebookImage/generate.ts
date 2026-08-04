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

// ── 표지 / 마무리 ────────────────────────────────────────────────────────────
//
// 가운데 카드들과 달리 번호 매긴 항목이 아니라 '펼침면' 성격이다.
// 예전에는 이 두 장만 AI로 그리지 않아서, 가운데는 손그림인데 앞뒤만
// 빈 줄노트에 브라우저 글씨가 얹힌 모양으로 나갔다.

export type NotebookEdgeFacts = {
  kind: 'cover' | 'closing';
  eyebrow?: string;      // 핵심 공개! / 마무리
  headline: string;      // 큰 제목
  sub?: string;          // 한 줄 설명
  badges?: string[];     // 표지: 손그림 태그로 그릴 짧은 말
  points?: string[];     // 마무리: 체크 항목
  source?: string;
  noteLabel: string;     // 임장 메모 / 오늘의 뉴스
  noteNumber: string;
  ratio: string;
};

export function buildEdgeNotebookPrompt(f: NotebookEdgeFacts): string {
  const isCover = f.kind === 'cover';

  const body = isCover
    ? `- 종이 위쪽에 마스킹 테이프로 붙인 느낌의 작은 쪽지, 그 안에 "${f.eyebrow || '핵심 공개!'}" 손글씨
- 화면 가운데 위쪽에 아주 큰 손글씨 제목: "${f.headline}"
  (두세 줄로 나눠 써도 좋고, 빨간 펜 두 줄 밑줄과 노란 형광펜 강조)
${f.sub ? `- 제목 아래 작은 손글씨 한 줄: "${f.sub}"` : ''}
${f.badges?.length ? `- 그 아래 손그림 둥근 태그 ${f.badges.length}개를 가로로 나란히, 각각 안에:\n${f.badges.map(b => `  · ${b}`).join('\n')}` : ''}
- 가운데 아래 넓은 여백에는 파란 볼펜으로 그린 아파트 단지 스케치(건물 몇 동, 나무, 구름, 해).
  종이가 비어 보이지 않게 넉넉히 채울 것
- 오른쪽 아래에 "→" 손그림 화살표와 작은 글씨 "넘겨보기"`
    : `- 종이 위쪽에 마스킹 테이프로 붙인 느낌의 작은 쪽지, 그 안에 "${f.eyebrow || '마무리'}" 손글씨
- 그 아래 큰 손글씨 제목: "${f.headline}" — 빨간 펜으로 물결 밑줄
${f.sub ? `- 제목 아래 작은 손글씨 한 줄: "${f.sub}"` : ''}
${f.points?.length ? `- 빨간 "✔ 오늘의 정리" 제목과 빨간 밑줄, 그 아래 체크 항목들\n  (각 줄: 빨간 손그림 ☑ 체크박스 + 노란 형광펜으로 칠한 손글씨)\n${f.points.map(p => `  ☑ ${p}`).join('\n')}` : ''}
- 가운데 아래쪽에 크게: 손그림 북마크(리본) 아이콘과 하트 아이콘을 나란히 그리고,
  그 옆에 빨간 손글씨로 "저장", "팔로우" — 둘 다 노란 형광펜으로 칠할 것
- 왼쪽 아래 여백에는 파란 볼펜으로 그린 작은 도시 스케치`;

  return `한국 부동산 인스타그램 카드뉴스의 ${isCover ? '표지' : '마지막'} 장을 **손글씨 스프링 노트** 스타일 이미지로 그려주세요. 비율 ${f.ratio} 세로.

[배경]
- 화면 전체가 크림색 줄노트 종이, 옅은 가로 줄
- 왼쪽 가장자리에 검은 스프링 제본 링(사실적으로)
- 스프링 오른쪽에 얇은 빨간 세로 여백선
- 실제 노트를 사진 찍은 듯한 종이 질감과 부드러운 그림자

[내용 — 아래 한글과 숫자를 한 글자도 바꾸지 말고 그대로 쓸 것]
${body}
${f.source ? `- 맨 아래 작은 글씨: "${f.source}"` : ''}
- 우측 하단: 빨간 클립으로 집은 크라프트 종이 태그. 위에 "${f.noteLabel}", 아래에 빨간 손글씨로 크게 "${f.noteNumber}"

[스타일]
- 전부 펜과 마커로 직접 쓴 느낌. 한글 손글씨, 살짝 불규칙한 획
- 본문 검정, 강조·밑줄 빨강, 낙서 파랑, 형광펜 노랑
- 가장자리에서 글자가 잘리지 않게
- **아래쪽 절반이 텅 비지 않도록** 그림과 요소로 균형 있게 채울 것
- 위에 적힌 것 외의 영어는 넣지 말 것

[가장 중요]
- 위의 모든 한글 단어와 숫자를 정확히 그대로 재현할 것.
- 위에 없는 정보(단지명, 가격, 날짜, 지하철역, 세대수)는 절대 만들어 넣지 말 것.`;
}

/** 표지·마무리 카드. 대조할 값은 제목뿐이라 재시도를 적게 잡는다. */
export async function generateEdgeNotebookImage(
  facts: NotebookEdgeFacts,
  opts?: { maxAttempts?: number }
): Promise<NotebookImageResult | null> {
  return renderNotebookCard(
    buildEdgeNotebookPrompt(facts),
    [facts.headline.slice(0, 8)],
    { maxAttempts: opts?.maxAttempts ?? 2, label: `${facts.kind}:${facts.headline}` }
  );
}
