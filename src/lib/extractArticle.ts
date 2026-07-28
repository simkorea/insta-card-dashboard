// 뉴스/블로그 URL에서 "기사 본문"만 뽑아낸다.
//
// 예전에는 HTML 전체에서 태그만 지우고 앞 3000자를 잘라 AI에 넘겼는데,
// 대부분의 뉴스 사이트는 앞부분이 네비게이션 메뉴·광고라서
// ("본문 바로가기 메뉴 최신뉴스 정치 북한 경제 …") 기사와 전혀 다른
// 카드뉴스가 만들어졌다. 그래서 본문 영역을 찾아 들어간 뒤 텍스트를 뽑는다.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 본문이 들어있는 컨테이너 후보 (앞쪽일수록 우선). 한국 주요 언론/블로그 기준.
const CONTENT_HINTS = [
  'se-main-container',      // 네이버 블로그 스마트에디터
  'postViewArea',           // 네이버 블로그 구버전
  'dic_area',               // 네이버 뉴스
  'newsct_article',         // 네이버 뉴스
  'articleBodyContents',    // 네이버 뉴스 구버전
  'harmonyContainer',       // 다음 뉴스
  'story-news',             // 연합뉴스
  'article-txt',            // 연합뉴스
  'articleBody',
  'article-body',
  'article_body',
  'news_body',
  'entry-content',          // 티스토리/워드프레스
  'tt_article_useless_p_margin', // 티스토리
  'post-content',
  'articleView',
];

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function stripNoise(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');
}

function metaContent(html: string, key: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
    'i'
  );
  return decodeEntities((html.match(re)?.[1] || html.match(alt)?.[1] || '').trim());
}

// 네이버 블로그는 본문이 iframe 안에 있어서 원래 주소로는 내용을 못 읽는다 → 실제 본문 주소로 바꾼다
function normalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (/(^|\.)blog\.naver\.com$/.test(u.hostname)) {
      if (u.pathname.startsWith('/PostView')) return rawUrl;
      const m = u.pathname.match(/^\/([^/]+)\/(\d+)/);
      if (m) return `https://blog.naver.com/PostView.naver?blogId=${m[1]}&logNo=${m[2]}`;
      const blogId = u.searchParams.get('blogId');
      const logNo = u.searchParams.get('logNo');
      if (blogId && logNo) return `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`;
    }
  } catch {
    /* URL 파싱 실패하면 원본 그대로 */
  }
  return rawUrl;
}

// 여는 태그 위치에서 같은 태그의 짝이 되는 닫는 태그까지 잘라낸다(중첩 깊이를 센다).
// 못 찾으면 그 지점부터 끝까지 돌려준다.
function sliceElement(html: string, startIdx: number): string {
  const tagName = html.slice(startIdx).match(/^<([a-z][a-z0-9]*)/i)?.[1];
  if (!tagName) return html.slice(startIdx);

  const re = new RegExp(`<${tagName}\\b[^>]*>|</${tagName}\\s*>`, 'gi');
  re.lastIndex = startIdx;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) return html.slice(startIdx, m.index + m[0].length);
    } else if (!m[0].endsWith('/>')) {
      depth++;
    }
  }
  return html.slice(startIdx);
}

// 본문 컨테이너를 찾아 그 부분만 잘라낸다. 못 찾으면 전체를 그대로 쓴다.
function extractContentArea(html: string): string {
  for (const hint of CONTENT_HINTS) {
    const re = new RegExp(`<[a-z]+[^>]*(?:id|class)=["'][^"']*${hint}[^"']*["'][^>]*>`, 'i');
    const m = html.match(re);
    if (m && m.index !== undefined) {
      const sliced = sliceElement(html, m.index);
      // 너무 짧게 잘렸으면(잘못 짝지어진 경우) 그 지점부터 끝까지로 대체
      if (plainText(sliced).length >= 200) return sliced;
      return html.slice(m.index);
    }
  }
  const article = html.match(/<article\b[^>]*>/i);
  if (article && article.index !== undefined) return sliceElement(html, article.index);
  return html;
}

function textFromBlocks(html: string): string {
  const lines: string[] = [];
  const blockRe = /<(p|h1|h2|h3|h4|li|dd|blockquote|span)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const t = decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (t.length >= 10) lines.push(t);
  }
  // 같은 문장이 반복되는 경우(공유 위젯 등) 제거
  return [...new Set(lines)].join('\n');
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export type ExtractedArticle = { title: string; text: string; finalUrl: string };

export async function extractArticle(rawUrl: string, maxChars = 6000): Promise<ExtractedArticle> {
  const url = normalizeUrl(rawUrl);

  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });

  if (!res.ok) throw new Error(`페이지를 불러오지 못했습니다 (상태 ${res.status})`);

  const rawHtml = await res.text();
  const title = metaContent(rawHtml, 'og:title') || (rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const desc = metaContent(rawHtml, 'og:description') || metaContent(rawHtml, 'description');

  // <br>은 줄바꿈으로 살려둔다 — 네이버 뉴스처럼 <p> 없이 <br>로만 단락을 나누는 본문이 있다
  const cleaned = stripNoise(rawHtml).replace(/<br\s*\/?>/gi, '\n');
  const body = extractContentArea(cleaned);

  const blockText = textFromBlocks(body);
  const flatText = plainText(body);
  // 블록 태그로 뽑은 쪽이 충분하면 그걸 쓰고(잡음이 적다), 아니면 통째 텍스트를 쓴다
  const text = blockText.length >= 300 || blockText.length >= flatText.length ? blockText : flatText;

  const composed = [
    title && `제목: ${decodeEntities(title)}`,
    desc && `요약: ${desc}`,
    text && `본문:\n${text}`,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, maxChars);

  // 내용을 못 읽었으면 지어내지 말고 실패시킨다.
  // 예전에는 "URL 정보만으로 생성합니다"로 넘어가서 엉뚱한 카드뉴스가 나왔다.
  if (composed.replace(/\s/g, '').length < 150) {
    throw new Error('이 주소에서 본문을 읽지 못했습니다. 로그인이 필요하거나 스크립트로 그려지는 페이지일 수 있어요. 본문을 복사해 텍스트로 붙여넣어 주세요.');
  }

  return { title: decodeEntities(title), text: composed, finalUrl: url };
}
