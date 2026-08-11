import type { SlideBlock } from './blocks';
import { readCardBlocks } from './readCardBlocks';

// 슬라이드쇼 영상에 얹을 내레이션 대본을 카드 내용에서 만든다.
//
// AI에게 새로 쓰게 하지 않는다. 카드에 적힌 수치와 문구는 이미 생성 단계의
// 가드레일(원문 충실도, 수치 지어내기 금지)을 통과한 것이라, 여기서 다시
// 말을 지으면 그 검증을 우회하는 셈이 된다. 있는 문장을 읽기 좋게 잇는다.
//
// 만든 대본은 화면에서 고칠 수 있다 — 읽었을 때 어색한 곳은 사람이 손본다.

type PageLike = {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  blocks?: SlideBlock[];
};

/** 문장 끝을 정리한다. 마침표가 없으면 붙여야 TTS가 끊어 읽는다. */
function period(t: string): string {
  const s = t.trim();
  if (!s) return '';
  return /[.!?…]$/.test(s) ? s : `${s}.`;
}

function onePage(p: PageLike): string {
  const parts: string[] = [];

  if (p.blocks?.length) {
    const f = readCardBlocks(p.blocks);
    if (f.headline) parts.push(period(f.headline));
    if (f.sub) parts.push(period(f.sub));
    // 수치는 한 줄만 읽는다 — 표를 통째로 읽으면 영상에서 지루하다
    const big = f.rows.find(r => r.highlight) || f.rows[0];
    if (big) parts.push(period(big.label ? `${big.label}는 ${big.value}` : big.value));
    // 핵심은 두 개까지. 다 읽으면 슬라이드 한 장이 너무 길어진다
    const pts = f.points.slice(0, 2);
    if (pts.length) parts.push(period(pts.join(', ')));
  } else {
    if (p.title) parts.push(period(p.title));
    if (p.subtitle) parts.push(period(p.subtitle));
    for (const b of (p.bullets || []).slice(0, 2)) parts.push(period(b));
  }

  return parts.join(' ').trim();
}

export function buildNarration(pages: PageLike[]): string[] {
  return pages.map(onePage);
}
