// 뉴스 수집에서 오래된 기사를 거르는 기준.
//
// JTBC 경제 RSS 는 2024-10-29 에서 멈춘 피드인데(20건 전부 그 날짜), 날짜를 보지 않고 받아서
// 같은 옛 기사("둔촌주공 입주 앞두고…")가 37일 동안 매일 브리핑·카드뉴스·블로그에 들어갔다.

export const FRESH_DAYS = 2;

/** RSS 날짜 문자열을 시각(ms)으로. RFC822("Mon, 23 Nov 2026 11:48:38 +0900")와 "2024.10.29" 형식을 읽는다. 못 읽으면 null. */
export function parsePubDate(raw?: string): number | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (s.includes(':')) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }
  const m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]) - 9 * 3600_000; // 한국 날짜 0시
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/** 최근 days 일 안에 나온 기사인가. 날짜를 모르면 거르지 않는다(링크 중복 검사가 대신 막는다). */
export function isFresh(raw: string | undefined, now = Date.now(), days = FRESH_DAYS): boolean {
  const t = parsePubDate(raw);
  if (t === null) return true;
  return now - t <= days * 86_400_000 && t - now < 86_400_000;
}
