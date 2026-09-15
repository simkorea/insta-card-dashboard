// 인스타에 올릴 최종 캡션 = 캡션 + (캡션에 아직 없는 해시태그만).
//
// scheduled_posts.hashtags 는 text 컬럼인데 배열을 넣는 경로가 있어 '[]' 로
// 저장됐다. 예전에는 그걸 그대로 붙여 캡션이 "…\n\n[]" 로 끝났다(자동 뉴스 전부).
// 캡션에서 뽑아 따로 저장한 태그를 다시 붙여 두 번 올라가기도 했다(편집기 예약).
//
// 크론과 즉시 발행이 이 함수 하나를 같이 쓴다 — 따로 두면 한쪽만 고쳐진다.
// 이미 있는지는 태그 단위로 정확히 비교한다. 문자열 포함으로 보면 '#재테크'가
// '#재테크그램' 안에서 걸려 빠진다.
const TAG = /#[^\s#,]+/g;

export function composeCaption(caption: string | null | undefined, hashtags?: string | null): string {
  const base = (caption || '').trim();
  const existing = new Set(base.match(TAG) ?? []);
  const fresh = [...new Set(String(hashtags ?? '').match(TAG) ?? [])].filter(t => !existing.has(t));
  return fresh.length ? `${base}\n\n${fresh.join(' ')}` : base;
}
