// 본문 끝의 해시태그 줄.
//
// 태그는 blog_posts.tags 칸에 잘 저장되고 있었다. 문제는 본문과 따로
// 논다는 것이다 — 저장한 글을 네이버에 붙여넣으면 태그가 안 따라가서
// 태그만 다시 복사해 붙여야 했다. 실제로 저장된 글을 열어 보면 본문 끝에
// 태그가 있는 것도 있고 없는 것도 있어 들쭉날쭉했다 (AI가 쓸 때도 있고
// 안 쓸 때도 있었다).
//
// 저장·복사·다운로드가 전부 같은 함수를 쓰게 해서 결과를 하나로 맞춘다.

// 마지막 줄이 전부 해시태그일 때만 매칭한다. 본문 중간의 '#'이나
// 소제목 기호를 건드리지 않기 위해서다.
const HASHTAG_LINE = /\n+(?:#[^\s#]+[ \t]*)+$/;

/**
 * 본문 끝에 태그 줄을 붙인다.
 *
 * 이미 붙어 있던 태그 줄은 지우고 다시 붙이므로, 저장을 두 번 눌러도
 * 태그를 고친 뒤 다시 저장해도 줄이 쌓이지 않는다.
 */
export function withTagLine(body: string, tags?: string[] | null): string {
  // 태그 목록 자체가 없으면(예전 글, 태그를 안 넘긴 경로) 본문을 그대로 둔다.
  // 여기서 지워 버리면 본문 끝에 손으로 써 둔 태그가 조용히 사라진다.
  // 빈 배열은 다르다 — 사용자가 태그를 다 지운 것이므로 줄도 없앤다.
  if (tags == null) return body || '';

  const base = (body || '').replace(HASHTAG_LINE, '').trimEnd();
  if (!tags.length) return base;
  const line = tags
    .map(t => `#${String(t).replace(/^#+/, '').trim()}`)
    .filter(t => t.length > 1)
    .join(' ');
  return line ? `${base}\n\n${line}` : base;
}
