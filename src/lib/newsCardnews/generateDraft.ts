import { callAI } from '@/lib/ai/openrouter';
import { createClient } from '@supabase/supabase-js';
import type { SlideBlock } from '@/lib/cardnews/blocks';
import { generateNewsNotebookImage, generateEdgeNotebookImage, type CardStyle } from '@/lib/notebookImage/generate';
import { uploadNotebookImage } from '@/lib/notebookImage/upload';
import { mapWithLimit, budget } from '@/lib/notebookImage/pool';
import { normalizeHeadlines } from '@/lib/cardnews/normalizeHeadline';
import { notebookFactsFromBlocks } from '@/lib/notebookImage/factsFromBlocks';

// 아침 브리핑 본문 → 카드뉴스 "초안"을 만들어 내 보관함(card_designs)에 저장한다.
// 장수는 그날 쓸 만한 기사 수를 따라간다 (3~10장).
// 발행은 하지 않는다. 크론(/api/cron/news-cardnews)과 수동 생성 버튼이 같이 쓴다.

type GeneratedCard = {
  page: number;
  title: string;
  body: string;
  imageKeyword: string;
  blocks: SlideBlock[];
};

export type DraftResult =
  | { ok: true; skipped: true; designId: string; name: string }
  | { ok: true; skipped: false; designId: string; name: string; slides: number }
  | { ok: false; error: string; status: number };

const OVERLAY = 'linear-gradient(to top, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.40) 100%)';
const ACCENT = '#E9B949';
// 장수는 그날 쓸 만한 기사 수에 맞춘다.
// 예전에는 5장 고정이라 관련 기사가 8건 나온 날에도 3건이 그냥 버려졌다.
const MAX_SLIDES = 10;  // 인스타 캐러셀 한도
const MIN_SLIDES = 3;   // 이보다 적으면 기사 배정 없이 요약본으로 만든다
// 표지 + 마무리 2장을 앞뒤로 붙이므로 기사는 그만큼 적게 담는다.
// 안 그러면 캐러셀 한도(10장)를 넘겨 발행에서 잘린다.
const EDGE_SLIDES = 2;
const FALLBACK_SLIDE_COUNT = 5; // 원본 기사가 없어 요약본으로 만들 때

type NewsItem = { title: string; link?: string; description?: string };

// @aptshowhome은 분양 정보 계정이다. 수집 순서대로 앞에서 자르면
// "대통령 아파트 근저당", "재경위 부동산세 공방" 같은 정치·시사 기사가
// 카드뉴스로 들어가버린다. 계정 성격에 맞는 기사를 점수로 골라낸다.
const TOPIC_WEIGHTS: [string, number][] = [
  ['분양', 6], ['청약', 6], ['입주', 5], ['모델하우스', 5], ['신도시', 4],
  ['재건축', 4], ['재개발', 4], ['아파트', 3], ['오피스텔', 2], ['단지', 3],
  ['시세', 3], ['집값', 3], ['매매', 3], ['전세', 3], ['월세', 2],
  ['공급', 3], ['미분양', 4], ['분양가', 5], ['GTX', 4], ['역세권', 4],
  ['금리', 2], ['대출', 2], ['규제', 2], ['학군', 3], ['평형', 3],
];

// 분양 콘텐츠로 쓰기 어려운 기사 (정치 공방·인물·사건사고·시혜성 보도)
const DROP_PATTERNS = [
  '대통령', '의원', '여야', '與', '野', '국회', '재경위', '국정감사', '공방',
  '검찰', '경찰', '구속', '기소', '고발', '수사', '재판', '판결',
  '사망', '숨져', '부상', '화재', '붕괴', '사고', '실종',
  '무상임대', '취약계층', '기부', '후원', '봉사',
  '북한', '트럼프', '관세', '증시', '코스피', '코스닥', '주가',
  // 주식 기사가 '대출'·'매매' 때문에 부동산으로 잡히는 걸 막는다.
  // 실제로 "하락장서 던진 개미들 비명…'빚투' 반대매매엔 한숨만"이 3점을 받아
  // 분양 계정 카드뉴스 후보로 올라왔다.
  '개미', '빚투', '반대매매', '곱버스', '하락장', '반도체', '공모주', '상장',
  // 부동산 기사로 분류되지만 분양 콘텐츠와는 무관한 것들
  '산단', '산업단지', '공항', '활주로', '건설근로자', '공제회',
  '아카데미', '폭염', '건설현장', '중대재해', '안전점검', '해외',
];

// 부동산 키워드를 '엉뚱한 뜻으로' 물고 들어오는 기사들.
// 제외어로 잘라내기엔 애매하고(어떤 날은 관련 기사일 수도 있다), 점수만으로도
// 안 걸러진다 — 실제로 "서울핀테크랩, 핀테크 기업 15곳 모집…최대 4년 입주"가
// '입주' 5점을 받아 둔촌주공 기사(3점)보다 높은 순위로 카드가 됐다.
// 그래서 깎는 방식으로 다룬다.
const NEGATIVE_WEIGHTS: [string, number][] = [
  ['핀테크', 10], ['스타트업', 10], ['입주기업', 10], ['창업', 6],  // '입주'가 사무실 입주인 경우
  ['유류분', 8], ['상속', 5],                                      // 분양 정보와 무관한 판례
  ['가치체계', 8], ['특별법', 6], ['의회', 6],                       // 기업 홍보·지자체 발표
];

// 이보다 낮으면 카드로 만들지 않는다. 장수를 채우려고 관련 없는 기사를
// 끌어오는 걸 막는다 — 빈약한 10장보다 탄탄한 7장이 낫다.
const MIN_SCORE = 3;

function scoreNews(n: NewsItem): number {
  const text = `${n.title} ${n.description || ''}`;
  if (DROP_PATTERNS.some(p => n.title.includes(p))) return -1;
  let score = 0;
  for (const [kw, w] of TOPIC_WEIGHTS) {
    if (n.title.includes(kw)) score += w;
    else if (text.includes(kw)) score += Math.ceil(w / 2);
  }
  for (const [kw, w] of NEGATIVE_WEIGHTS) {
    if (text.includes(kw)) score -= w;
  }
  return score;
}

function pickRelevantNews(items: NewsItem[], limit: number): NewsItem[] {
  const scored = items
    .filter(n => n && typeof n.title === 'string' && n.title.trim())
    .map(n => ({ n, s: scoreNews(n) }))
    .filter(x => x.s >= MIN_SCORE)
    .sort((a, b) => b.s - a.s);

  const out: NewsItem[] = [];
  for (const { n } of scored) {
    if (out.length >= limit) break;
    // 제목 앞부분이 겹치는 유사 기사는 한 건만
    if (out.some(o => o.title.slice(0, 12) === n.title.slice(0, 12))) continue;
    out.push(n);
  }
  return out;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function searchBackground(keyword: string): Promise<string> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !keyword) return '';
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=1&orientation=portrait`,
      { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return '';
    const data = await res.json();
    return data.results?.[0]?.urls?.regular || '';
  } catch {
    return '';
  }
}

export async function generateNewsCardnewsDraft(opts?: {
  force?: boolean;
  notebookStyle?: boolean;
  maxSlides?: number;
  // 'notebook'(기본) | 'newspaper' 는 AI가 카드를 통째로 그린다.
  // 'hybrid' 는 미리 뽑아둔 종이·펜그림 위에 브라우저가 글자를 조판한다 — AI 호출 0회.
  cardStyle?: CardStyle | 'hybrid' | 'hybridPaper';
  /** 그림에 쓸 시간(ms). 브리핑 뒤에 이어 돌 때는 남은 시간만 쓴다 */
  imageBudgetMs?: number;
}): Promise<DraftResult> {
  const supabase = serviceClient();

  const { data: briefing, error: bErr } = await supabase
    .from('briefings')
    .select('id, date, real_estate_summary, news_items, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bErr) return { ok: false, error: `브리핑 조회 실패: ${bErr.message}`, status: 500 };

  const summary = (briefing?.real_estate_summary || '').trim();
  if (!summary || summary.length < 200) {
    return { ok: false, error: '사용할 브리핑 본문이 없습니다. 먼저 일일 브리핑이 생성되어야 합니다.', status: 503 };
  }

  // 원본 뉴스가 있으면 "뉴스 1건 = 카드 1장"으로 만든다.
  // 요약문만 주면 AI가 여러 기사를 섞어 새로운 이야기를 지어내서
  // 원문에 없는 내용이 나왔다.
  const rawItems = Array.isArray(briefing?.news_items) ? (briefing!.news_items as NewsItem[]) : [];
  // 쓸 만한 기사가 나온 만큼 장을 만든다 (최대 10장).
  // opts.maxSlides로 그날만 줄여 부를 수도 있다.
  const totalCap = Math.min(Math.max(Number(opts?.maxSlides) || MAX_SLIDES, MIN_SLIDES), MAX_SLIDES);
  // 표지·마무리가 2장을 차지하므로 기사에 쓸 수 있는 장수는 그만큼 줄어든다
  const cap = Math.max(totalCap - EDGE_SLIDES, 1);
  const picked = pickRelevantNews(rawItems, cap);
  const hasItems = picked.length >= MIN_SLIDES;
  console.log(`[NewsCardnews] 수집 ${rawItems.length}건 → 사용 ${picked.length}건 (기사 최대 ${cap}장 + 표지·마무리)`);

  // 같은 브리핑으로 이미 만든 초안이 있으면 중복 생성하지 않는다
  if (!opts?.force) {
    const { data: dup } = await supabase
      .from('card_designs')
      .select('id, name')
      .eq('description', `briefing:${briefing!.id}`)
      .limit(1)
      .maybeSingle();
    if (dup) return { ok: true, skipped: true, designId: dup.id, name: dup.name };
  }

  // 카드 1장이 담당할 뉴스를 미리 정해서 넘긴다. AI가 소재를 고르거나 합치지 못하게 한다.
  const sourceBlock = hasItems
    ? picked
        .map(
          (n, i) =>
            `[${i + 1}장이 다룰 뉴스]\n제목: ${n.title}\n내용: ${(n.description || '').slice(0, 400) || '(요약 없음 — 제목 범위 안에서만 작성)'}`
        )
        .join('\n\n')
    : summary.slice(0, 6000);

  const mappingRule = hasItems
    ? `[가장 중요한 규칙 — 뉴스 1건 = 카드 1장]
- 아래에 ${picked.length}개의 뉴스가 있고, 각 뉴스 앞에 몇 번째 장에서 다룰지 적어두었습니다.
- 1장은 1번 뉴스만, 2장은 2번 뉴스만 다루세요. 한 장에 여러 뉴스를 섞지 마세요.
- 배정된 뉴스에 없는 수치·지역·단지명·일정·가격을 지어내지 마세요.
- 뉴스에 담긴 사실이 적으면 장을 억지로 채우지 말고 짧게 쓰세요.
- 정확히 ${picked.length}장을 만드세요.`
    : `[규칙]
- 브리핑에서 서로 다른 주제 5개를 골라, 한 장에 한 주제만 담으세요. 여러 주제를 한 장에 섞지 마세요.
- 브리핑에 없는 수치·지역·단지명·일정·가격을 지어내지 마세요.
- 정확히 5장을 만드세요.`;

  const prompt = `아래는 오늘자 부동산 뉴스입니다.
부동산 분양 정보 인스타그램 계정(@aptshowhome)에 올릴 카드뉴스를 만들어주세요.

${mappingRule}

반드시 아래 JSON 구조로만 응답하세요 (코드블록 없이):
{
  "title": "이 카드뉴스 세트의 제목 (20자 이내)",
  "cards": [
    { "page": 1, "title": "슬라이드 제목", "body": "요약 텍스트", "imageKeyword": "Unsplash 검색용 영어 키워드",
      "blocks": [ { "type": "eyebrow", "text": "TODAY" }, { "type": "headline", "text": "핵심 제목", "accentText": "강조어" } ] }
  ]
}

[블록 타입]
- { "type":"eyebrow", "text":"섹션 라벨 (영문 대문자)" }
- { "type":"headline", "text":"메인 제목", "accentText":"제목 뒤에 이어 붙일 강조 문구(선택)" }
  ※ accentText는 제목 **안의 단어를 색칠하는 게 아니라 text 뒤에 이어 붙습니다.**
     text에 이미 있는 말을 accentText에 또 쓰면 "…전세 눈치게임 눈치게임"처럼 두 번 찍힙니다.
     text와 accentText를 이어 읽었을 때 자연스러운 한 문장이 되어야 하고,
     겹치는 말이 생길 것 같으면 accentText를 아예 빼세요.
- { "type":"sub", "text":"보조 설명" }
- { "type":"bigNumber", "value":"4.36%", "caption":"설명(선택)" }
- { "type":"statGrid", "cols":3, "items":[{"value":"43%","label":"청약자 증가"}] }
- { "type":"compareTable", "rows":[{"label":"항목","value":"값","highlight":true}] }
- { "type":"timeline", "items":[{"date":"2026.8","title":"제목","desc":"설명","state":"active"}] }
- { "type":"checklist", "items":["항목1","항목2"] }
- { "type":"badgeRow", "badges":[{"text":"태그","tone":"gold"}] }
- { "type":"sourceNote", "text":"출처: ..." }

[각 장의 서식 — 모든 장을 같은 틀로 채울 것]
1) eyebrow: "① 분야" 형태. 번호는 장 순서(①②③④⑤), 분야는 2~4자 한글
   (예: "① 청약", "② 분양가", "③ 공급", "④ 시세", "⑤ 규제")
2) headline: 그 뉴스의 핵심. 공백 포함 18자 이내, 짧은 명사형
3) sub: 무슨 일인지 한 문장. 40자 이내
4) checklist: 그 뉴스에서 뽑은 핵심 포인트 3~4개. 각 22자 이내
   — 이게 카드의 본문이다. 절대 생략하지 말 것
5) 수치가 있으면 checklist 앞에 bigNumber(대표 수치 1개) 또는
   statGrid(수치 2~3개)를 추가. 없으면 넣지 않는다
6) sourceNote: "출처: 언론사명" 한 줄

[내용 규칙]
- 한 장은 배정된 뉴스 1건만 다룬다. 다른 뉴스 내용을 섞지 말 것.
- 뉴스에 없는 수치·지역·단지명·일정·가격을 지어내지 말 것.
- 확인되지 않은 분양가·입주일·청약 자격은 단정하지 말 것.
- 실거주자·수요자에게 무엇을 의미하는지가 드러나게 쓸 것.
- body와 title 필드도 비우지 말 것. title은 그 장이 다루는 뉴스 제목을 짧게 줄인 것.

${sourceBlock}`;

  let text: string;
  try {
    text = await callAI({
      prompt,
      model: 'anthropic/claude-haiku-4.5',
      maxTokens: 8000,
      system: '당신은 부동산 분양 정보를 다루는 SNS 콘텐츠 기획자입니다.',
    });
  } catch (e: any) {
    return { ok: false, error: `AI 생성 실패: ${e.message}`, status: 502 };
  }

  if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
  else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

  let parsed: { title?: string; cards?: GeneratedCard[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error('[NewsCardnews] JSON 파싱 실패:', text.slice(0, 300));
    return { ok: false, error: 'AI 응답 형식이 올바르지 않습니다. 다시 시도해주세요.', status: 502 };
  }

  const cards = (parsed.cards || [])
    .filter(c => Array.isArray(c.blocks) && c.blocks.length > 0)
    .slice(0, hasItems ? picked.length : FALLBACK_SLIDE_COUNT)
    // 강조어가 제목에 이미 들어 있으면 카드에 두 번 찍힌다 — 저장 전에 정리
    .map(c => ({ ...c, blocks: normalizeHeadlines(c.blocks) }));
  if (cards.length === 0) return { ok: false, error: '생성된 슬라이드가 없습니다.', status: 502 };

  // 손글씨 노트 스타일. 단지 카드와 같은 룩으로 통일하고,
  // 이미지 생성이 안 되면 CSS 노트 렌더러(styleVariant 'notebook')로 떨어진다.
  // 사진 배경은 노트 스타일에서 쓰지 않으므로 Unsplash 검색도 건너뛴다.
  const useNotebook = opts?.notebookStyle !== false;
  // 하이브리드는 그림을 새로 그리지 않는다 — 자산이 이미 있고 글자는 브라우저가 얹는다.
  // 브리핑 뒤에 이어 돌 때 남은 시간이 모자라 그림을 한 장도 못 그리던 문제가
  // 이 경로에서는 아예 생기지 않는다.
  const isHybrid = opts?.cardStyle === 'hybrid' || opts?.cardStyle === 'hybridPaper';
  const hybridVariant = opts?.cardStyle === 'hybridPaper' ? 'hybridPaper' : 'hybrid';
  const cardStyle: CardStyle = opts?.cardStyle === 'newspaper' ? 'newspaper' : 'notebook';
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const noteNumber = `No.${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}${String(kstNow.getUTCDate()).padStart(2, '0')}`;

  const backgrounds = useNotebook
    ? cards.map(() => '')
    : await Promise.all(cards.map(c => searchBackground(c.imageKeyword)));

  // 한꺼번에 던지면 서로 밀려 호출마다 제한에 걸린다 — 몇 개씩 나눠 돌린다.
  const imgBudget = budget(Math.max(Number(opts?.imageBudgetMs) || 400_000, 30_000));
  const notebookImages: (string | null)[] = useNotebook && !isHybrid
    ? await mapWithLimit(cards, 3, async (card, i) => {
        if (!imgBudget.canStart(70_000)) return null;
        const facts = notebookFactsFromBlocks(card.blocks, i + 1);
        if (!facts.headline || facts.points.length === 0) return null;
        const img = await generateNewsNotebookImage(
          { ...facts, noteNumber, ratio: '4:5' },
          { style: cardStyle }
        );
        if (!img) return null;
        return (await uploadNotebookImage(img.base64, i + 1)) || null;
      })
    : cards.map(() => null);

  console.log(
    `[NewsCardnews] 노트 이미지 ${notebookImages.filter(Boolean).length}/${cards.length}장 생성`
  );

  const label = `${kstNow.getUTCMonth() + 1}/${kstNow.getUTCDate()}`;

  // 에디터가 그대로 읽는 PageData 형태
  const articlePages = cards.map((card, i) => ({
    id: String(i + 1),
    bgImage: notebookImages[i] || backgrounds[i] || '',
    bgLabel: isHybrid ? (hybridVariant === 'hybridPaper' ? '신문(빠름)' : '노트(빠름)') : useNotebook ? (cardStyle === 'newspaper' ? '신문 지면' : '손글씨 노트') : card.imageKeyword || '배경 이미지',
    // 노트 이미지는 그림 한 장이 카드 전체다 — 어둡게 덮으면 글씨가 안 보인다
    overlay: notebookImages[i] ? '' : useNotebook ? '' : OVERLAY,
    ratio: '4:5',
    styleVariant: isHybrid ? hybridVariant : notebookImages[i] ? 'image' : useNotebook ? 'notebook' : undefined,
    noteLabel: useNotebook ? '오늘의 뉴스' : undefined,
    noteNumber: useNotebook ? noteNumber : undefined,
    title: card.title || '',
    // 인트로 문구는 이제 표지가 맡는다
    subtitle: '',
    layout: 'bottom-left-list',
    accent: ACCENT,
    blocks: card.blocks,
    brandTone: 'gold',
    showFrame: true,
    blocksOffsetY: 90,
    handle: '@aptshowhome',
    imageKeyword: card.imageKeyword,
    titleStyle: { fontFamily: 'Noto Sans KR', fontWeight: '900', fontSize: 32, letterSpacing: -0.5, color: '#FFFFFF' },
    subtitleStyle: { fontFamily: 'Noto Sans KR', fontWeight: '400', fontSize: 15, color: '#E5E7EB' },
    bulletStyle: { fontFamily: 'Noto Sans KR', fontWeight: '600', fontSize: 15, lineHeight: 1.35, color: '#FFFFFF' },
  }));

  const name = `[자동] ${label} ${parsed.title || '부동산 뉴스'}`;

  // ── 표지 · 마무리 ──────────────────────────────────────────────────────────
  // 예전에는 1장부터 바로 기사로 시작해 기사로 끝났다. 캐러셀은 첫 장에서
  // 넘길지 말지가 갈리고 마지막 장이 저장·팔로우를 부르는 자리라 둘 다 필요하다.
  const coverHeadline = parsed.title || `${label} 부동산 뉴스`;
  const coverBadges = ['오늘의 핵심', `${articlePages.length}가지`, '저장 추천'];
  const closingPoints = ['오늘의 핵심만 정리', '분양·청약 일정 체크', '매일 아침 업데이트'];
  const closingHeadline = '저장해두고 매일 아침 확인하세요';

  const edgeFacts = (kind: 'cover' | 'closing') =>
    kind === 'cover'
      ? {
          kind, eyebrow: '오늘의 뉴스', headline: coverHeadline,
          sub: `${label} 부동산 소식을 한 장씩 정리했습니다.`,
          badges: coverBadges, noteLabel: '오늘의 뉴스', noteNumber, ratio: '4:5',
        } as const
      : {
          kind, eyebrow: '마무리', headline: closingHeadline,
          sub: '부동산 소식은 매일 아침 올라옵니다.',
          points: closingPoints, noteLabel: '오늘의 뉴스', noteNumber, ratio: '4:5',
        } as const;

  const drawEdge = async (kind: 'cover' | 'closing', uploadIndex: number) => {
    if (!useNotebook || isHybrid || !imgBudget.canStart(70_000)) return null;
    const img = await generateEdgeNotebookImage(edgeFacts(kind), { style: cardStyle });
    if (!img) return null;
    return (await uploadNotebookImage(img.base64, uploadIndex)) || null;
  };

  const [coverImage, closingImage] = await Promise.all([drawEdge('cover', 0), drawEdge('closing', 99)]);

  const edgePage = (
    kind: 'cover' | 'closing',
    image: string | null,
    blocks: SlideBlock[],
    title: string
  ) => ({
    id: kind,
    bgImage: image || '',
    bgLabel: isHybrid ? (hybridVariant === 'hybridPaper' ? '신문(빠름)' : '노트(빠름)') : useNotebook ? (cardStyle === 'newspaper' ? '신문 지면' : '손글씨 노트') : '배경 이미지',
    overlay: image ? '' : useNotebook ? '' : OVERLAY,
    ratio: '4:5',
    styleVariant: isHybrid ? hybridVariant : image ? 'image' : useNotebook ? 'notebook' : undefined,
    noteLabel: useNotebook ? '오늘의 뉴스' : undefined,
    noteNumber: useNotebook ? noteNumber : undefined,
    title,
    subtitle: '',
    layout: 'bottom-left-list',
    accent: ACCENT,
    blocks,
    brandTone: 'gold',
    showFrame: true,
    blocksOffsetY: 78,
    handle: '@aptshowhome',
    imageKeyword: '',
    titleStyle: { fontFamily: 'Noto Sans KR', fontWeight: '900', fontSize: 32, letterSpacing: -0.5, color: '#FFFFFF' },
    subtitleStyle: { fontFamily: 'Noto Sans KR', fontWeight: '400', fontSize: 15, color: '#E5E7EB' },
    bulletStyle: { fontFamily: 'Noto Sans KR', fontWeight: '600', fontSize: 15, lineHeight: 1.35, color: '#FFFFFF' },
  });

  const coverPage = edgePage('cover', coverImage, [
    { type: 'eyebrow', text: '오늘의 뉴스' },
    { type: 'headline', text: coverHeadline },
    { type: 'sub', text: `${label} 부동산 소식을 한 장씩 정리했습니다.` },
    { type: 'badgeRow', badges: coverBadges.map(text => ({ text })) },
  ], coverHeadline);

  const closingPage = edgePage('closing', closingImage, [
    { type: 'eyebrow', text: '마무리' },
    { type: 'headline', text: '저장해두고', accentText: '매일 아침 확인하세요' },
    { type: 'sub', text: '부동산 소식은 매일 아침 올라옵니다.' },
    { type: 'checklist', items: closingPoints },
  ], closingHeadline);

  // 장 번호는 합친 뒤 다시 매긴다
  const pagesData = [coverPage, ...articlePages, closingPage].map((p, i) => ({
    ...p,
    id: String(i + 1),
  }));

  const { data: design, error: insErr } = await supabase
    .from('card_designs')
    .insert({
      name,
      description: `briefing:${briefing!.id}`,
      pages_data: pagesData,
      category: '자동 뉴스',
    })
    .select('id')
    .single();

  if (insErr) return { ok: false, error: `초안 저장 실패: ${insErr.message}`, status: 500 };

  console.log(`[NewsCardnews] 초안 생성 완료: ${name} (${pagesData.length}장)`);
  return { ok: true, skipped: false, designId: design.id, name, slides: pagesData.length };
}
