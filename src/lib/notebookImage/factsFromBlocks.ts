import type { SlideBlock } from '@/lib/cardnews/blocks';

// 이미 만들어진 카드 blocks에서 노트 이미지에 넣을 사실만 뽑는다.
//
// 여기서 문구를 새로 만들지 않는 게 핵심이다. blocks는 이미 각 생성 경로의
// 가드레일(원문 충실도, 수치 지어내기 금지)을 통과한 결과이므로 그대로 옮기기만 한다.
// 아침 뉴스 초안과 카드뉴스 생성 화면이 같은 함수를 쓴다.

export type NotebookFactsFromBlocks = {
  index: number;
  category: string;
  headline: string;
  lead?: string;
  points: string[];
  stat?: { value: string; label?: string };
  source?: string;
};

export function notebookFactsFromBlocks(blocks: SlideBlock[], index: number): NotebookFactsFromBlocks {
  const find = <T extends SlideBlock['type']>(t: T) =>
    blocks.find(b => b.type === t) as Extract<SlideBlock, { type: T }> | undefined;

  const eyebrow = find('eyebrow')?.text || '';
  const headlineBlock = find('headline');
  const headline = [headlineBlock?.text, headlineBlock?.accentText].filter(Boolean).join(' ').trim();
  const big = find('bigNumber');
  const stats = find('statGrid');

  // checklist가 없는 카드(표지 등)는 배지·표에서 항목을 끌어온다.
  // 포인트가 하나도 없으면 노트 카드의 본문이 비어버린다.
  let points = (find('checklist')?.items || []).slice(0, 4);
  if (points.length === 0) {
    const badges = find('badgeRow')?.badges?.map(b => b.text) || [];
    const rows = find('compareTable')?.rows?.map(r => `${r.label} ${r.value}`) || [];
    points = [...badges, ...rows].filter(Boolean).slice(0, 4);
  }

  return {
    index,
    // "① 청약" 형태에서 번호 기호를 떼고 분야만 남긴다 (번호는 따로 그린다)
    category: eyebrow.replace(/^[①②③④⑤⑥⑦⑧⑨⑩\d.\s]+/, '').trim() || '오늘의 정보',
    headline,
    lead: find('sub')?.text,
    points,
    stat: big
      ? { value: big.value, label: big.caption }
      : stats?.items?.[0]
        ? { value: stats.items[0].value, label: stats.items[0].label }
        : undefined,
    source: find('sourceNote')?.text,
  };
}
