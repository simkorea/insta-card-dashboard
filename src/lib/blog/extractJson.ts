// AI 응답에서 JSON 객체만 꺼낸다.
//
// 저장소의 기존 방식은 ```json 펜스를 지우고 JSON.parse 하는 것인데,
// 채점 라우트를 만들며 재보니 그걸로는 깨진다. OpenRouter 에
// response_format: {type:'json_object'} 를 켜도 앞뒤에 설명 문장이 붙어
// 나오는 경우가 있었다 — 3회 시도에서 3회 모두 붙었다.
//
// 그래서 펜스를 지우는 대신, 첫 '{' 부터 짝이 맞는 '}' 까지만 잘라낸다.
// 문자열 안의 중괄호와 이스케이프를 건너뛰므로 본문에 { } 가 들어 있어도
// 안전하다.

const BACKSLASH = String.fromCharCode(92);

export function extractJson<T = unknown>(raw: string): T {
  const text = String(raw ?? '');
  const start = text.indexOf('{');
  if (start < 0) throw new Error('AI 응답에서 JSON을 찾지 못했습니다.');

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) { escaped = false; continue; }
    if (ch === BACKSLASH) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1)) as T;
    }
  }

  throw new Error('AI 응답의 JSON이 끝나지 않았습니다. (응답이 잘렸을 수 있습니다)');
}
