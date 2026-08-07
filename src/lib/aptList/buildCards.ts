import { callAI } from '@/lib/ai/openrouter';
import type { SlideBlock } from '@/lib/cardnews/blocks';
import type { AptRecord } from './parseTransactions';
import {
  generateNotebookImage,
  generateEdgeNotebookImage,
  type NotebookEdgeFacts,
  type CardStyle,
} from '@/lib/notebookImage/generate';
import { uploadNotebookImage } from '@/lib/notebookImage/upload';
import { mapWithLimit, budget } from '@/lib/notebookImage/pool';

// 단지 목록 → 손글씨 노트 스타일 카드뉴스 페이지.
//
// 핵심 원칙: 가격·평형·연식·지역은 붙여넣은 실거래 데이터에서만 가져온다.
// AI는 "장점 문구"와 "메모"만 쓴다. 시세를 지어내면 실제 매물 정보가
// 틀리는 것이라 사고가 크다.

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

export type AptCardPage = {
  id: string;
  blocks: SlideBlock[];
  // 'image' = AI가 그린 노트 카드 이미지 그대로, 'notebook' = CSS 렌더러(폴백)
  styleVariant: 'notebook' | 'image' | 'hybrid' | 'hybridPaper';
  ratio: string;
  needsReview?: boolean;   // 숫자 검증을 못 넘긴 장 — 사람이 확인해야 함
  reviewNote?: string;
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
- 메모는 40자 이내 한 문장. 어색한 조어("거주 목적층", "물건대")를 쓰지 말고 자연스러운 한국어로.
- 과장·투자 권유 표현("무조건 오른다", "지금이 마지막 기회") 금지.

[평형 표기 기준 — 전용면적 기준이며 반드시 지킬 것]
- 20평 미만: 소형. 1~2인 가구
- 20~29평: 중소형. 2~3인 가구, 신혼·소가족
- 30~39평: 중형. 3~4인 가구
- 40평 이상: 대형. 4인 이상
26평을 "소형", "1~2인"이라고 쓰는 식의 잘못된 분류를 하지 말 것.

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
  useAiImage?: boolean; // AI가 카드를 통째로 그릴지 (기본 true)
  // 'notebook'(기본) | 'newspaper' 는 AI가 카드를 통째로 그린다.
  // 'hybrid' 는 미리 뽑아둔 종이·펜그림 위에 브라우저가 글자를 조판한다 — AI 호출 0회.
  cardStyle?: CardStyle | 'hybrid' | 'hybridPaper';
}): Promise<AptCardPage[]> {
  const records = opts.records.slice(0, 10);
  const ratio = opts.ratio || '4:5';
  const isHybrid = opts.cardStyle === 'hybrid' || opts.cardStyle === 'hybridPaper';
  const hybridVariant = opts.cardStyle === 'hybridPaper' ? 'hybridPaper' : 'hybrid';
  const cardStyle: CardStyle = opts.cardStyle === 'newspaper' ? 'newspaper' : 'notebook';
  const noteLabel = cardStyle === 'newspaper' ? '실거래 리포트' : '임장노트';
  const noteNumber = opts.noteNumber || 'No.001';

  const copies = await writeCopy(records, opts.title);

  const base = (id: string, blocks: SlideBlock[], title: string): AptCardPage => ({
    id,
    blocks,
    styleVariant: (isHybrid ? hybridVariant : 'notebook') as AptCardPage['styleVariant'],
    ratio,
    noteLabel,
    noteNumber,
    bgImage: '',
    bgLabel: isHybrid ? (hybridVariant === 'hybridPaper' ? '신문(빠름)' : '노트(빠름)') : '노트 배경',
    overlay: '',
    title,
    subtitle: '',
    layout: 'bottom-left-list',
  });

  const pages: AptCardPage[] = [];

  /**
   * 표지·마무리에 손글씨 노트 그림을 입힌다.
   * 예전에는 이 두 장만 AI로 그리지 않아서, 가운데는 손그림인데 앞뒤만
   * 빈 줄노트에 브라우저 글씨가 얹힌 모양으로 나갔다.
   */
  const drawEdge = async (page: AptCardPage, facts: NotebookEdgeFacts, uploadIndex: number) => {
    const img = await generateEdgeNotebookImage(facts, { style: cardStyle });
    if (!img) {
      page.needsReview = true;
      page.reviewNote = '노트 그림 생성에 실패해 기본 스타일로 만들었습니다';
      return;
    }
    const url = await uploadNotebookImage(img.base64, uploadIndex);
    if (!url) {
      page.needsReview = true;
      page.reviewNote = '노트 이미지 저장에 실패해 기본 스타일로 만들었습니다';
      return;
    }
    page.bgImage = url;
    page.styleVariant = 'image';
    if (!img.verified) {
      page.needsReview = true;
      page.reviewNote = img.note;
    }
  };

  /** 단지 카드에 그림을 입힌다. drawEdge와 실패 처리 방식이 같다. */
  const drawItem = async (
    page: AptCardPage,
    facts: Parameters<typeof generateNotebookImage>[0],
    uploadIndex: number
  ) => {
    // 장수가 많으면 재시도까지 할 시간이 없다 — 3회는 예산을 다 먹는다
    const img = await generateNotebookImage(facts, { style: cardStyle, maxAttempts: 2 });
    if (!img) {
      page.needsReview = true;
      page.reviewNote = '그림 생성에 실패해 기본 스타일로 만들었습니다';
      return;
    }
    const url = await uploadNotebookImage(img.base64, uploadIndex);
    if (!url) {
      // 그림은 나왔는데 저장이 안 된 경우 — 조용히 넘어가면 왜 노트가 아닌지 알 수 없다
      page.needsReview = true;
      page.reviewNote = '이미지 저장에 실패해 기본 스타일로 만들었습니다';
      return;
    }
    page.bgImage = url;
    page.styleVariant = 'image';
    if (!img.verified) {
      page.needsReview = true;
      page.reviewNote = img.note;
    }
  };

  // 표지
  // 제목에 이미 "TOP4" 같은 표현이 있으면 강조어를 덧붙이지 않는다.
  // 그냥 붙였더니 "안양 만안구 실거래가 TOP4 TOP 4"가 됐다.
  const titleHasTop = /top\s*\d/i.test(opts.title);
  const coverTitle = titleHasTop ? opts.title : `${opts.title} TOP ${records.length}`;
  const coverBadges = ['실거래가 기준', `${records.length}개 단지`, '저장 추천'];
  const coverPage = base('1', [
    { type: 'eyebrow', text: '핵심 공개!' },
    { type: 'headline', text: opts.title, accentText: titleHasTop ? undefined : `TOP ${records.length}` },
    { type: 'sub', text: '국토부 실거래가로 확인한 단지만 골랐습니다.' },
    { type: 'badgeRow', badges: coverBadges.map(text => ({ text })) },
    { type: 'sourceNote', text: '출처: 국토교통부 실거래가 공개시스템' },
  ], opts.title);
  pages.push(coverPage);

  // 단지별 1장 — 손글씨 노트는 AI 이미지로 그린다 (CSS로는 그 질감이 안 나옴)
  const useAi = opts.useAiImage !== false;
  // 그림은 여기서 그리지 않는다. 페이지를 먼저 다 만들고, 표지·마무리까지
  // 합쳐 한 묶음으로 개수를 조절해가며 그린다(아래 '그림 그리기' 참고).
  const itemJobs: { page: AptCardPage; facts: Parameters<typeof generateNotebookImage>[0] }[] = [];
  const itemPages = records.map((r, i) => {
      const copy = copies[i];
      const advantages = copy.advantages.length > 0 ? copy.advantages : factAdvantages(r);
      const pyeongText = r.pyeong ? `전용 ${r.pyeong}평` : undefined;
      const builtText = r.builtYear ? `${r.builtYear}년식` : undefined;

      const rows: { label: string; value: string; highlight?: boolean }[] = [];
      if (r.region) rows.push({ label: '위치', value: r.region });
      if (pyeongText) rows.push({ label: '평형', value: `${pyeongText} (${r.areaM2}㎡)` });
      if (r.priceText) rows.push({ label: '실거래가', value: r.priceText, highlight: true });
      if (builtText) rows.push({ label: '연식', value: builtText });
      if (r.floor) rows.push({ label: '거래층', value: `${r.floor}층` });
      // 임장할 때 "언제 거래된 값인지"가 가격만큼 중요하다
      const dealText = r.dealDateText || r.dealDate;
      if (dealText) rows.push({ label: '계약일', value: dealText });
      if (r.rgstDate) rows.push({ label: '등기일', value: r.rgstDate });

      // blocks는 항상 만들어 둔다 — 이미지 생성이 실패하면 이걸로 그리고,
      // 성공해도 나중에 CSS 스타일로 바꾸거나 문구를 고칠 때 쓴다
      const blocks: SlideBlock[] = [
        { type: 'eyebrow', text: `${CIRCLED[i] || `${i + 1}.`} ${shortDong(r.region) || '단지'}` },
        { type: 'headline', text: r.name },
      ];
      if (rows.length) blocks.push({ type: 'compareTable', rows });
      if (advantages.length) blocks.push({ type: 'checklist', items: advantages });
      if (copy.memo) blocks.push({ type: 'sub', text: copy.memo });
      blocks.push({ type: 'sourceNote', text: '출처: 국토교통부 실거래가' });

      const page = base(String(i + 2), blocks, r.name);

      itemJobs.push({
        page,
        facts: {
          index: i + 1,
          dong: shortDong(r.region) || r.region,
          name: r.name,
          region: r.region,
          pyeong: pyeongText,
          price: r.priceText,
          built: builtText,
          dealDate: dealText,
          advantages,
          memo: copy.memo,
          noteLabel,
          noteNumber,
          ratio,
        },
      });
      return page;
  });
  pages.push(...itemPages);

  // 마무리
  const closingPoints = ['실거래가 기준 정리', '평형·연식 비교', '지역별 생활권 확인'];
  const closingPage = base(String(records.length + 2), [
    { type: 'eyebrow', text: '마무리' },
    { type: 'headline', text: '저장해두면', accentText: '내 집 마련에 도움' },
    { type: 'sub', text: '궁금한 단지는 댓글이나 DM으로 남겨주세요.' },
    { type: 'checklist', items: closingPoints },
    { type: 'sourceNote', text: '실거래가는 신고 기준이며 현재 시세와 다를 수 있습니다.' },
  ], '마무리');
  pages.push(closingPage);

  // ── 그림 그리기 ────────────────────────────────────────────────────────────
  // 표지·단지·마무리를 한 묶음으로 그린다.
  //
  // 전부 한꺼번에(Promise.all) 던지면 안 된다. 9장을 동시에 보냈더니 Gemini
  // 쪽에서 서로 밀려 호출마다 120초 제한에 걸렸고, 재시도까지 겹쳐 라우트가
  // 300초를 넘겨 통째로 죽었다. 몇 개씩 나눠 도는 편이 오히려 빨리 끝난다.
  // 업로드 index는 파일명에만 쓰이므로 표지·마무리는 0, 99를 준다.
  // 하이브리드는 그릴 것이 없다 — 자산이 이미 있고 글자는 브라우저가 얹는다
  if (useAi && !isHybrid) {
    const bud = budget(265_000);
    const jobs: { page: AptCardPage; run: () => Promise<void> }[] = [
      {
        page: coverPage,
        run: () => drawEdge(coverPage, {
          kind: 'cover',
          eyebrow: '핵심 공개!',
          headline: coverTitle,
          sub: '국토부 실거래가로 확인한 단지만 골랐습니다.',
          badges: coverBadges,
          source: '출처: 국토교통부 실거래가 공개시스템',
          noteLabel, noteNumber, ratio,
        }, 0),
      },
      ...itemJobs.map((j, i) => ({
        page: j.page,
        run: () => drawItem(j.page, j.facts, i + 1),
      })),
      {
        page: closingPage,
        run: () => drawEdge(closingPage, {
          kind: 'closing',
          eyebrow: '마무리',
          headline: '저장해두면 내 집 마련에 도움',
          sub: '궁금한 단지는 댓글이나 DM으로 남겨주세요.',
          points: closingPoints,
          source: '실거래가는 신고 기준이며 현재 시세와 다를 수 있습니다.',
          noteLabel, noteNumber, ratio,
        }, 99),
      },
    ];

    await mapWithLimit(jobs, 4, async job => {
      // 시간이 다하면 나머지는 기본 스타일로 남긴다.
      // 라우트가 죽어 통째로 실패하는 것보다 몇 장이라도 건지는 게 낫다.
      if (!bud.canStart(70_000)) {
        job.page.needsReview = true;
        job.page.reviewNote = '시간이 모자라 기본 스타일로 남겼습니다. 단지 수를 줄이면 모두 그려집니다';
        return;
      }
      await job.run();
    });
  }

  return pages;
}
