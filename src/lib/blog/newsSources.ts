// 브리핑에 저장된 실제 기사를 블로그 글의 출처로 쓴다.
//
// 채점에서 GEO(AI 인용 가능성)가 50점에서 안 움직였고, 상위 지적이 전부
// 출처 관련이었다 — 출처 명시, 출처 구체성, 주장-근거 연결. 그때는 "출처는
// 프롬프트로 만들어 낼 수 없다"고 두었는데, 브리핑이 기사 20건을 제목·링크와
// 함께 이미 저장하고 있었다. 지어낼 필요 없이 있는 것을 쓰면 된다.
//
// 링크는 AI에게 맡기지 않는다. 주소를 쓰라고 하면 그럴듯한 URL을 만들어
// 내는데, 없는 주소를 단 출처는 없느니만 못하다. 본문에는 [1] 같은 번호만
// 쓰게 하고 실제 주소는 아래 코드가 붙인다.

export type NewsItem = { title?: string; link?: string; description?: string };

/** 링크 주소에서 언론사 이름을 얻는다. 모르는 곳은 도메인을 그대로 쓴다. */
const PRESS: Record<string, string> = {
  'yna.co.kr': '연합뉴스',
  'newsis.com': '뉴시스',
  'news1.kr': '뉴스1',
  'mk.co.kr': '매일경제',
  'hankyung.com': '한국경제',
  'edaily.co.kr': '이데일리',
  'sedaily.com': '서울경제',
  'mt.co.kr': '머니투데이',
  'fnnews.com': '파이낸셜뉴스',
  'asiae.co.kr': '아시아경제',
  'heraldcorp.com': '헤럴드경제',
  'chosun.com': '조선일보',
  'donga.com': '동아일보',
  'joongang.co.kr': '중앙일보',
  'hani.co.kr': '한겨레',
  'khan.co.kr': '경향신문',
  'seoul.co.kr': '서울신문',
  'kbs.co.kr': 'KBS',
  'imbc.com': 'MBC',
  'sbs.co.kr': 'SBS',
  'ytn.co.kr': 'YTN',
};

export function pressName(link?: string): string {
  if (!link) return '';
  try {
    const host = new URL(link).hostname.replace(/^www\./, '');
    for (const [domain, name] of Object.entries(PRESS)) {
      if (host === domain || host.endsWith('.' + domain)) return name;
    }
    return host;
  } catch {
    return '';
  }
}

/** 쓸 만한 기사만 남긴다 — 제목과 주소가 둘 다 있어야 출처가 된다 */
export function usableSources(items: unknown, limit = 12): NewsItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((n): n is NewsItem => Boolean(n && typeof n === 'object'))
    .filter(n => (n.title || '').trim() && (n.link || '').startsWith('http'))
    .slice(0, limit);
}

/** 프롬프트에 넣을 기사 목록. 주소는 넣지 않는다 — 본문에 옮겨 적지 못하게. */
export function buildSourceListForPrompt(items: NewsItem[], dateLabel: string): string {
  const lines = items.map((n, i) => {
    const press = pressName(n.link);
    const desc = (n.description || '').replace(/\s+/g, ' ').slice(0, 90);
    return `[${i + 1}] ${n.title}${press ? ` (${press}, ${dateLabel})` : ''}${desc ? ` — ${desc}` : ''}`;
  });
  return lines.join('\n');
}

/**
 * 본문에 실제로 인용된 번호를 찾는다.
 *
 * AI가 알려준 목록(usedSources)만 믿지 않는다. 본문에 [3] 이라고 써 놓고
 * 목록에는 빠뜨리면 독자가 [3]을 찾을 수 없다. 둘을 합쳐서 쓴다.
 */
export function citedIndexes(body: string, usedSources: unknown, total: number): number[] {
  const found = new Set<number>();
  for (const m of String(body || '').matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= total) found.add(n);
  }
  if (Array.isArray(usedSources)) {
    for (const v of usedSources) {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= total) found.add(n);
    }
  }
  return [...found].sort((a, b) => a - b);
}

/** 글 끝에 붙일 출처 목록. 인용된 것이 없으면 아무것도 붙이지 않는다. */
export function buildSourceSection(items: NewsItem[], cited: number[], dateLabel: string): string {
  if (cited.length === 0) return '';
  const lines = cited.map(n => {
    const it = items[n - 1];
    if (!it) return '';
    const press = pressName(it.link);
    return `[${n}] ${it.title} — ${press || '출처'} (${dateLabel})\n${it.link}`;
  }).filter(Boolean);
  if (lines.length === 0) return '';
  return `\n\n출처\n${lines.join('\n')}`;
}
