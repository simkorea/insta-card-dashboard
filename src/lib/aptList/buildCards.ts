import { callAI } from '@/lib/ai/openrouter';
import type { SlideBlock } from '@/lib/cardnews/blocks';
import type { AptRecord } from './parseTransactions';

// 단지 목록 → 손글씨 노트 스타일 카드뉴스 페이지.
//
// 핵심 원칙: 가격·평형·연식·지역은 붙여넣은 실거래 데이터에서만 가져온다.
// AI는 "장점 문구"와 "메모"만 쓴다. 시세를 지어내면 실제 매물 정보가
// 틀리는 것이라 사고가 크다.

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

export type AptCardPage = {
  id: string;
  blocks: SlideBlock[];
  styleVariant: 'notebook';
  ratio: string;
  noteLabel?: string;
  noteNumber?: string;
  // 노트 스타일은 배경사진을 쓰지 않지만 기존 PageData 호환용으로 채워둔다
  bgImage: string;
  bgLabel: string;
  overlay: string;
  title: string;
  subtitle: string;
  layout: 'bottom-left-list';
};

type Copy = { advantages: string[]; memo: string };

/** 지역 문자열에서 마지막 '동'만 뽑는다 (예: "경기도 안양시 만안구 안양동" → "안양동") */
function shortDong(region: string): string {
  const parts = region.split(/\s+/).filter(Boolean);
  const dong = [...parts].reverse().find(p => /[동읍면가]$/.test(p));
  return dong || parts[parts.length - 1] || '';
}

async function writeCopy(records: AptRecord[], theme: string): Promise<Copy[]> {
  const list = records
    .map((r, i) => {
      const facts = [
        `단지명: ${r.name}`,
        r.region && `지역: ${r.region}`,
        r.pyeong && `전용 ${r.pyeong}평(${r.areaM2}㎡)`,
        r.priceText && `실거래가: ${r.priceText}`,
        r.builtYear && `건축년도: ${r.builtYear}년`,
      ].filter(Boolean).join(' / ');
      return `[${i + 1}] ${facts}`;
    })
    .join('\n');

  const prompt = `아래는 국토부 실거래가에서 확인된 아파트 목록입니다.
각 단지마다 인스타그램 카드뉴스에 넣을 "장점 3~4개"와 "한 줄 메모"를 써주세요.

${list}

[반드시 지킬 것]
- 주어진 사실(지역·평형·실거래가·건축년도)에서 도출되는 내용만 쓸 것.
- 지하철역 이름, 도보 몇 분, 학군, 세대수, 브랜드 순위처럼 위에 없는 정보는
  절대 쓰지 말 것. 모르면 그 항목을 빼고 다른 장점을 쓸 것.
- "역세권", "초품아" 같은 단정도 위 정보로 확인되지 않으면 쓰지 말 것.
- 건축년도로 신축/구축 여부, 평형으로 실거주 적합성, 지역으로 생활권 정도만 언급 가능.
- 각 장점은 공백 포함 16자 이내의 짧은 구.
- 메모는 40자 이내 한 문장.
- 과장·투자 권유 표현("무조건 오른다", "지금이 마지막 기회") 금지.

주제: ${theme}

코드블록 없이 JSON만:
{"items":[{"advantages":["...","...","..."],"memo":"..."}]}`;

  try {
    let text = await callAI({
      prompt,
      model: 'anthropic/claude-haiku-4.5',
      maxTokens: 4000,
      system: '당신은 부동산 정보를 정확하게 다루는 SNS 콘텐츠 작성자입니다. 확인되지 않은 정보를 만들지 않습니다.',
    });
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();
    const parsed = JSON.parse(text) as { items?: Copy[] };
    return records.map((_, i) => ({
      advantages: parsed.items?.[i]?.advantages?.slice(0, 4) ?? [],
      memo: parsed.items?.[i]?.memo ?? '',
    }));
  } catch {
    // AI가 실패해도 사실 기반 카드는 만들어진다 (문구만 비워둔다)
    return records.map(() => ({ advantages: [], memo: '' }));
  }
}

/** 사실만으로 만드는 기본 장점 — AI 문구가 없을 때의 대체 */
function factAdvantages(r: AptRecord): string[] {
  const out: string[] = [];
  const dong = shortDong(r.region);
  if (dong) out.push(`${dong} 생활권`);
  if (r.pyeong) out.push(`전용 ${r.pyeong}평`);
  if (r.builtYear) {
    const age = new Date().getFullYear() - r.builtYear;
    out.push(age <= 10 ? '신축급 연식' : age >= 30 ? '재건축 연한 도달' : `${r.builtYear}년식`);
  }
  return out;
}

export async function buildAptListCards(opts: {
  records: AptRecord[];
  title: string;        // 예: "경기도 5억대 아파트"
  ratio?: string;
  noteNumber?: string;  // 예: "No.006"
}): Promise<AptCardPage[]> {
  const records = opts.records.slice(0, 10);
  const ratio = opts.ratio || '4:5';
  const noteLabel = '임장노트';
  const noteNumber = opts.noteNumber || 'No.001';

  const copies = await writeCopy(records, opts.title);

  const base = (id: string, blocks: SlideBlock[], title: string): AptCardPage => ({
    id,
    blocks,
    styleVariant: 'notebook',
    ratio,
    noteLabel,
    noteNumber,
    bgImage: '',
    bgLabel: '노트 배경',
    overlay: '',
    title,
    subtitle: '',
    layout: 'bottom-left-list',
  });

  const pages: AptCardPage[] = [];

  // 표지
  pages.push(
    base('1', [
      { type: 'eyebrow', text: '핵심 공개!' },
      { type: 'headline', text: opts.title, accentText: `TOP ${records.length}` },
      { type: 'sub', text: '국토부 실거래가로 확인한 단지만 골랐습니다.' },
      {
        type: 'badgeRow',
        badges: [{ text: '실거래가 기준' }, { text: `${records.length}개 단지` }, { text: '저장 추천' }],
      },
      { type: 'sourceNote', text: '출처: 국토교통부 실거래가 공개시스템' },
    ], opts.title)
  );

  // 단지별 1장
  records.forEach((r, i) => {
    const copy = copies[i];
    const advantages = copy.advantages.length > 0 ? copy.advantages : factAdvantages(r);
    const rows: { label: string; value: string; highlight?: boolean }[] = [];
    if (r.region) rows.push({ label: '위치', value: r.region });
    if (r.pyeong) rows.push({ label: '평형', value: `전용 ${r.pyeong}평 (${r.areaM2}㎡)` });
    if (r.priceText) rows.push({ label: '실거래가', value: r.priceText, highlight: true });
    if (r.builtYear) rows.push({ label: '연식', value: `${r.builtYear}년식` });
    if (r.floor) rows.push({ label: '거래층', value: `${r.floor}층` });

    const blocks: SlideBlock[] = [
      { type: 'eyebrow', text: `${CIRCLED[i] || `${i + 1}.`} ${shortDong(r.region) || '단지'}` },
      { type: 'headline', text: r.name },
    ];
    if (rows.length) blocks.push({ type: 'compareTable', rows });
    if (advantages.length) blocks.push({ type: 'checklist', items: advantages });
    if (copy.memo) blocks.push({ type: 'sub', text: copy.memo });
    blocks.push({ type: 'sourceNote', text: '출처: 국토교통부 실거래가' });

    pages.push(base(String(i + 2), blocks, r.name));
  });

  // 마무리
  pages.push(
    base(String(records.length + 2), [
      { type: 'eyebrow', text: '마무리' },
      { type: 'headline', text: '저장해두면', accentText: '내 집 마련에 도움' },
      { type: 'sub', text: '궁금한 단지는 댓글이나 DM으로 남겨주세요.' },
      {
        type: 'checklist',
        items: ['실거래가 기준 정리', '평형·연식 비교', '지역별 생활권 확인'],
      },
      { type: 'sourceNote', text: '실거래가는 신고 기준이며 현재 시세와 다를 수 있습니다.' },
    ], '마무리')
  );

  return pages;
}
