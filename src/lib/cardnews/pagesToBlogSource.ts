import type { SlideBlock } from './blocks';
import { readCardBlocks } from './readCardBlocks';

// 카드뉴스 → 블로그로 넘길 원문을 만든다.
//
// 예전에는 page.title / subtitle / bullets 세 개만 읽었다. 그런데 하이브리드·
// 노트·신문 카드는 내용이 전부 blocks 안에 있고 title은 표시용 사본일 뿐이라,
// 넘어가는 글이 제목 목록으로만 남았다:
//
//   [1장 표지] 제목: 부동산 시장 핫이슈 7일 요약
//   [2장 본문] 제목: 서울 59㎡ 분양가 15.6억
//
// 이걸로는 AI가 쓸 근거가 없어 블로그가 지어낸 내용으로 채워졌다.
// blocks에서 리드 문장·표·체크리스트·출처까지 전부 꺼내 붙인다.

type PageLike = {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  blocks?: SlideBlock[];
};

function onePage(p: PageLike, idx: number): string {
  const head = `[${idx + 1}장 ${idx === 0 ? '표지' : '본문'}]`;
  const lines: string[] = [head];

  if (p.blocks && p.blocks.length > 0) {
    const f = readCardBlocks(p.blocks, idx);
    if (f.bandText) lines.push(`분야: ${f.bandText}`);
    if (f.headline) lines.push(`제목: ${f.headline}`);
    if (f.sub) lines.push(`요약: ${f.sub}`);
    if (f.rows.length) {
      lines.push('수치:');
      for (const r of f.rows) {
        lines.push(r.label ? `- ${r.label}: ${r.value}` : `- ${r.value}`);
      }
    }
    if (f.points.length) {
      lines.push('핵심:');
      for (const it of f.points) lines.push(`- ${it}`);
    }
    if (f.source) lines.push(f.source);
    // blocks가 비어 있다시피 한 장은 예전 필드로 메운다
    if (lines.length === 1 && p.title) lines.push(`제목: ${p.title}`);
    return lines.join('\n');
  }

  // 사진 배경 스타일 카드는 예전 구조 그대로다
  if (p.title) lines.push(`제목: ${p.title}`);
  if (p.subtitle) lines.push(`소제목: ${p.subtitle}`);
  if (p.bullets?.length) {
    lines.push('상세:');
    for (const b of p.bullets) lines.push(`- ${b}`);
  }
  return lines.join('\n');
}

export function pagesToBlogSource(pages: PageLike[]): string {
  return pages.map(onePage).join('\n\n');
}

/** 제목만 있고 본문이 없는 카드 묶음인지 — 이 경우 블로그를 만들어도 알맹이가 없다 */
export function isTooThinForBlog(pages: PageLike[]): boolean {
  let body = 0;
  for (const p of pages) {
    if (p.blocks?.length) {
      const f = readCardBlocks(p.blocks);
      body += f.rows.length + f.points.length + (f.sub ? 1 : 0);
    } else {
      body += (p.bullets?.length || 0) + (p.subtitle ? 1 : 0);
    }
  }
  return body < 3;
}
