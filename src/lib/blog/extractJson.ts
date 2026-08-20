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
      if (depth === 0) return JSON.parse(repairControlChars(text.slice(start, i + 1))) as T;
    }
  }

  throw new Error('AI 응답의 JSON이 끝나지 않았습니다. (응답이 잘렸을 수 있습니다)');
}

/**
 * 문자열 안에 그대로 들어온 줄바꿈·탭을 이스케이프한다.
 *
 * 긴 한국어 본문을 JSON 으로 받으면 모델이 body 안에 진짜 줄바꿈을 넣어
 * 보낸다. JSON 규격상 문자열 안에는 못 들어가는 문자라 JSON.parse 가
 * "Bad control character in string literal" 로 죽는다 — 브리핑을 블로그로
 * 옮길 때 실제로 이걸로 실패했다. 모델에게 잘 이스케이프하라고 시키는
 * 것보다 받아서 고치는 편이 확실하다.
 */
function repairControlChars(json: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (const ch of json) {
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === BACKSLASH) { out += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }

    if (inString) {
      // 줄바꿈(10)/캐리지리턴(13)/탭(9) 은 이스케이프해 살린다
      const code = ch.charCodeAt(0);
      if (code === 10) { out += BACKSLASH + 'n'; continue; }
      if (code === 13) { out += BACKSLASH + 'r'; continue; }
      if (code === 9) { out += BACKSLASH + 't'; continue; }
      if (code < 32) continue; // 그 밖의 제어문자는 버린다
    }
    out += ch;
  }
  return out;
}
