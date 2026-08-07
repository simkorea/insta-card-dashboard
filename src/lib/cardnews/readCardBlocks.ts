import type { SlideBlock } from './blocks';

// 카드 blocks에서 화면에 그릴 값만 뽑는다.
//
// 노트(HybridRenderer)와 신문(NewspaperRenderer)이 같은 데이터를 서로 다른
// 모양으로 그린다. 해석을 각자 하면 한쪽만 고쳐져 조용히 어긋나므로 여기 모은다.
// 여기서 문구를 새로 만들지 않는다 — blocks는 이미 생성 단계의 가드레일
// (원문 충실도, 수치 지어내기 금지)을 통과한 결과다.

export type CardFacts = {
  eyebrow: string;
  bandText: string;   // 번호를 뗀 분야명 ("① 금리" → "금리")
  ribbon: string;     // 번호
  headline: string;
  sub: string;
  rows: { label: string; value: string; highlight?: boolean }[];
  points: string[];
  source: string;
  hasTable: boolean;  // 단지 카드인지(표 있음) 뉴스 카드인지 가른다
  sketchText: string; // 그림 고를 때 쓸 본문 전체
};

export function readCardBlocks(blocks: SlideBlock[], index = 0): CardFacts {
  const find = <T extends SlideBlock['type']>(t: T) =>
    blocks.find(b => b.type === t) as Extract<SlideBlock, { type: T }> | undefined;

  const eyebrow = find('eyebrow')?.text?.trim() || '';
  const headlineBlock = find('headline');
  const headline = [headlineBlock?.text, headlineBlock?.accentText].filter(Boolean).join(' ').trim();
  const sub = find('sub')?.text?.trim() || '';
  const table = find('compareTable');
  const big = find('bigNumber');
  const checklist = find('checklist')?.items || [];
  const badges = find('badgeRow')?.badges?.map(b => b.text) || [];
  const source = find('sourceNote')?.text?.trim() || '';

  const rawRows = table?.rows
    ?? (big ? [{ label: big.caption || '', value: big.value, highlight: true }] : []);

  // 연식과 계약일을 한 줄로 합친다.
  // 따로 두면 줄 수 제한에 밀려 계약일이 통째로 잘려나간다 — 임장에서는
  // "언제 거래된 값인지"가 가격만큼 중요해서 빠지면 안 되는 정보다.
  const rows: { label: string; value: string; highlight?: boolean }[] = [];
  let ageAt = -1;
  for (const r of rawRows) {
    if (/연식|준공/.test(r.label)) { ageAt = rows.length; rows.push({ ...r }); continue; }
    if (/계약일|거래일|신고일|등기일/.test(r.label) && ageAt >= 0) {
      rows[ageAt] = { ...rows[ageAt], value: `${rows[ageAt].value} · ${r.value} 계약` };
      continue;
    }
    rows.push(r);
  }

  const points = (checklist.length ? checklist : badges).slice(0, 4);

  return {
    eyebrow,
    bandText: eyebrow.replace(/^[①②③④⑤⑥⑦⑧⑨⑩\d.\s)]+/, '').trim(),
    ribbon: eyebrow.match(/\d+/)?.[0] || String(index + 1),
    headline,
    sub,
    rows,
    points,
    source,
    hasTable: Boolean(table?.rows?.length),
    sketchText: `${eyebrow} ${headline} ${sub} ${points.join(' ')}`,
  };
}
