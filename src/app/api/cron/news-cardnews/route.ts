import { callAI } from '@/lib/ai/openrouter';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { SlideBlock } from '@/lib/cardnews/blocks';

// 아침 브리핑이 만들어진 직후 실행되어, 그날 뉴스로 카드뉴스 "초안"을 만들어 둔다.
// 자동으로 발행하지 않는다 — 내 보관함에 저장만 하고 사람이 확인 후 발행한다.
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type GeneratedCard = {
  page: number;
  title: string;
  body: string;
  imageKeyword: string;
  blocks: SlideBlock[];
};

const OVERLAY = 'linear-gradient(to top, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.40) 100%)';
const ACCENT = '#E9B949';

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

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. 가장 최근 브리핑 가져오기
    const { data: briefing, error: bErr } = await supabase
      .from('briefings')
      .select('id, date, real_estate_summary, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bErr) throw new Error(`브리핑 조회 실패: ${bErr.message}`);
    const summary = (briefing?.real_estate_summary || '').trim();
    if (!summary || summary.length < 200) {
      console.warn('[NewsCardnews] 사용할 브리핑 본문이 없어 건너뜀');
      return NextResponse.json({ success: false, error: '브리핑 본문이 없어 초안을 만들지 않았습니다.' }, { status: 503 });
    }

    // 같은 브리핑으로 이미 초안을 만들었으면 중복 생성하지 않는다
    const { data: dup } = await supabase
      .from('card_designs')
      .select('id')
      .eq('description', `briefing:${briefing!.id}`)
      .limit(1)
      .maybeSingle();
    if (dup) {
      console.log('[NewsCardnews] 이미 이 브리핑으로 만든 초안이 있어 건너뜀');
      return NextResponse.json({ success: true, skipped: true, designId: dup.id });
    }

    // 2. 브리핑 → 카드뉴스 슬라이드 생성
    const prompt = `아래는 오늘자 부동산 뉴스 브리핑입니다.
이 내용을 바탕으로 부동산 분양 정보 인스타그램 계정(@aptshowhome)에 올릴 카드뉴스 5장을 만들어주세요.

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

[규칙]
- 정확히 5장. 1장은 표지(eyebrow + headline + badgeRow), 마지막 장은 마무리(eyebrow + headline + sub + sourceNote).
- 각 blocks는 비우지 말고 eyebrow 1개 + headline 1개 + 내용 블록 1개 이상으로 구성.
- headline은 공백 포함 18자 이내, 짧은 명사형. sub는 40자 이내. checklist 항목은 22자 이내.
- 뉴스에 없는 수치나 일정을 지어내지 말 것. 확인되지 않은 분양가·입주일·청약 자격은 단정하지 말 것.
- body와 title 필드도 비우지 말 것.

브리핑 원문:
${summary.slice(0, 6000)}`;

    let text = await callAI({
      prompt,
      model: 'anthropic/claude-haiku-4.5',
      maxTokens: 8000,
      system: '당신은 부동산 분양 정보를 다루는 SNS 콘텐츠 기획자입니다.',
    });
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    let parsed: { title?: string; cards?: GeneratedCard[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('[NewsCardnews] JSON 파싱 실패:', text.slice(0, 300));
      throw new Error('AI 응답 형식이 올바르지 않습니다.');
    }

    const cards = (parsed.cards || []).filter(c => Array.isArray(c.blocks) && c.blocks.length > 0);
    if (cards.length === 0) throw new Error('생성된 슬라이드가 없습니다.');

    // 3. 배경 이미지 매칭
    const backgrounds = await Promise.all(cards.map(c => searchBackground(c.imageKeyword)));

    // 4. 에디터가 그대로 읽을 수 있는 PageData 형태로 변환
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

    // 5. 내 보관함에 초안으로 저장 (발행하지 않음)
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

    if (insErr) throw new Error(`초안 저장 실패: ${insErr.message}`);

    console.log(`[NewsCardnews] 초안 생성 완료: ${name} (${pagesData.length}장, ${Date.now() - startedAt}ms)`);
    return NextResponse.json({
      success: true,
      designId: design.id,
      name,
      slides: pagesData.length,
    });
  } catch (e: any) {
    console.error('[NewsCardnews] 실패:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
