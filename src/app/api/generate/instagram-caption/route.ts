import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { slides } = await request.json();
    if (!slides || !Array.isArray(slides)) {
      return NextResponse.json({ error: 'slides 배열이 필요합니다' }, { status: 400 });
    }

    const { data: persona } = await supabase.from('brand_personas').select('*').limit(1).maybeSingle();

    const slideText = slides
      .map((s: { title?: string; body?: string }, i: number) =>
        `[${i === 0 ? '표지' : `${i + 1}장`}] ${s.title || ''}\n${s.body || ''}`
      )
      .join('\n\n');

    const personaContext = persona ? `
[브랜드 페르소나]
- 브랜드명: ${persona.brand_name}
- 톤: ${persona.tone}
- 타겟: ${persona.target_audience}
- 업종: ${persona.industry}
- 목표: ${persona.posting_goal}
- 핵심 키워드: ${(persona.keywords || []).join(', ')}
- 이모지 스타일: ${persona.emoji_style}
위 페르소나를 반드시 반영하여 캡션과 해시태그를 작성하세요.
` : '';

    const prompt = `다음 카드뉴스 내용을 바탕으로 인스타그램 게시물 캡션과 해시태그를 생성하세요.
${personaContext}
카드뉴스 내용:
${slideText}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "caption": "인스타그램 캡션 텍스트 (이모지 포함, 공감 유발, 300-500자)",
  "hashtags": "#해시태그1 #해시태그2 #해시태그3 (15-20개, 한국어+영문 혼합)"
}

[지침]
- 캡션은 독자가 저장/공유하고 싶게 만드는 톤
- 마지막에 팔로우/저장 유도 문구 포함
- 해시태그는 인기 태그와 틈새 태그를 균형있게`;

    let text = await generateWithRetry(prompt);
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
