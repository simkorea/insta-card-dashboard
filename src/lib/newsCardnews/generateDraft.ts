import { callAI } from '@/lib/ai/openrouter';
import { createClient } from '@supabase/supabase-js';
import type { SlideBlock } from '@/lib/cardnews/blocks';

// 아침 브리핑 본문 → 카드뉴스 5장 "초안"을 만들어 내 보관함(card_designs)에 저장한다.
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
const SLIDE_COUNT = 5;

type NewsItem = { title: string; link?: string; description?: string };

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

export async function generateNewsCardnewsDraft(opts?: { force?: boolean }): Promise<DraftResult> {
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
  const picked = rawItems
    .filter(n => n && typeof n.title === 'string' && n.title.trim())
    .slice(0, SLIDE_COUNT);
  const hasItems = picked.length >= 3;

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
- { "type":"headline", "text":"메인 제목", "accentText":"강조할 3~6자(선택)" }
- { "type":"sub", "text":"보조 설명" }
- { "type":"bigNumber", "value":"4.36%", "caption":"설명(선택)" }
- { "type":"statGrid", "cols":3, "items":[{"value":"43%","label":"청약자 증가"}] }
- { "type":"compareTable", "rows":[{"label":"항목","value":"값","highlight":true}] }
- { "type":"timeline", "items":[{"date":"2026.8","title":"제목","desc":"설명","state":"active"}] }
- { "type":"checklist", "items":["항목1","항목2"] }
- { "type":"badgeRow", "badges":[{"text":"태그","tone":"gold"}] }
- { "type":"sourceNote", "text":"출처: ..." }

[작성 규칙]
- 각 장은 eyebrow 1개 + headline 1개 + 내용 블록 1개 이상으로 구성. blocks를 비우지 말 것.
- eyebrow는 그 장이 다루는 뉴스의 분야를 나타내는 영문 대문자 라벨 (예: RATES, SUPPLY, POLICY, MARKET).
- headline은 그 장의 뉴스 핵심을 공백 포함 18자 이내 명사형으로. sub는 40자 이내. checklist 항목은 22자 이내.
- 수치가 있으면 bigNumber나 statGrid로, 여러 항목이면 checklist나 compareTable로 표현할 것.
- 확인되지 않은 분양가·입주일·청약 자격은 단정하지 말 것.
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
    .slice(0, hasItems ? picked.length : SLIDE_COUNT);
  if (cards.length === 0) return { ok: false, error: '생성된 슬라이드가 없습니다.', status: 502 };

  const backgrounds = await Promise.all(cards.map(c => searchBackground(c.imageKeyword)));

  // 에디터가 그대로 읽는 PageData 형태
  const pagesData = cards.map((card, i) => ({
    id: String(i + 1),
    bgImage: backgrounds[i] || '',
    bgLabel: card.imageKeyword || '배경 이미지',
    overlay: OVERLAY,
    title: card.title || '',
    subtitle: i === 0 ? (card.body || '') : '',
    layout: 'bottom-left-list',
    accent: ACCENT,
    blocks: card.blocks,
    brandTone: 'gold',
    showFrame: true,
    blocksOffsetY: i === 0 ? 78 : 90,
    handle: '@aptshowhome',
    imageKeyword: card.imageKeyword,
    titleStyle: { fontFamily: 'Noto Sans KR', fontWeight: '900', fontSize: 32, letterSpacing: -0.5, color: '#FFFFFF' },
    subtitleStyle: { fontFamily: 'Noto Sans KR', fontWeight: '400', fontSize: 15, color: '#E5E7EB' },
    bulletStyle: { fontFamily: 'Noto Sans KR', fontWeight: '600', fontSize: 15, lineHeight: 1.35, color: '#FFFFFF' },
  }));

  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const label = `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`;
  const name = `[자동] ${label} ${parsed.title || '부동산 뉴스'}`;

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
