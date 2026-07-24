import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callAI } from '@/lib/ai/openrouter';
import { toKoreanError } from '@/lib/gemini';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { id, personaId } = await request.json();
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

    const { data: ad, error: fetchError } = await supabase
      .from('reference_ads')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError || !ad) throw new Error('레퍼런스를 찾을 수 없습니다');

    let brandName = '';
    let brandTone = '';
    if (personaId) {
      const { data: persona } = await supabase.from('brand_personas').select('*').eq('id', personaId).maybeSingle();
      if (persona) {
        brandName = persona.brand_name || '';
        brandTone = persona.tone || '';
      }
    }

    const prompt = `아래는 경쟁사 광고 레퍼런스입니다.

광고주: ${ad.advertiser_name || '알 수 없음'}
광고 문구: ${ad.ad_text || '(없음)'}

이 광고를 분석해서 아래 JSON 형식으로만 답변하세요 (마크다운 코드펜스 없이 순수 JSON):
{
  "core_message": "이 광고가 전달하는 핵심 메시지 한 줄",
  "structure": ["카피가 사용한 구조/기법을 단계별로 3~5개 bullet"],
  "hooks": ["시선을 끄는 후킹 문구나 숫자/혜택 요소 2~4개"],
  "cardnews_draft": {
    "headline": "${brandName || '우리 브랜드'}${brandTone ? `(톤: ${brandTone})` : ''} 기준으로 재구성한 카드뉴스 헤드라인",
    "sub": "서브 헤드라인",
    "slides": ["본문 슬라이드로 쓸 핵심 문장 3~4개"],
    "cta": "마무리 CTA 문구"
  }
}`;

    const raw = await callAI({
      prompt,
      model: 'deepseek/deepseek-v4-flash',
      system: '당신은 부동산 분양 마케팅 카피라이터입니다. 경쟁사 광고를 분석해 표절이 아닌, 구조와 전략만 참고한 새로운 카피를 제안합니다.',
      maxTokens: 4000,
    });

    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    const { data: updated, error: updateError } = await supabase
      .from('reference_ads')
      .update({ ai_analysis: analysis })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ item: updated });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
