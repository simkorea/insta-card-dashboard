import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PLATFORM_GUIDES: Record<string, string> = {
  instagram: '이모지 풍부, 저장 유도, 15-20개 해시태그, 300-500자 캡션',
  threads: '대화체, 짧고 임팩트 있게, 해시태그 3-5개, 150-250자',
  linkedin: '전문적·인사이트 중심, 커리어 관점, 해시태그 3-5개, 400-600자, 이모지 절제',
  twitter: '140자 이내, 핵심만, 해시태그 1-2개, 강한 훅',
  facebook: '스토리텔링 형식, 공유 유도, 300-400자, 해시태그 없거나 최소',
};

export async function POST(request: Request) {
  try {
    const { slides, platforms } = await request.json();
    if (!slides || !Array.isArray(slides)) {
      return NextResponse.json({ error: 'slides 배열이 필요합니다' }, { status: 400 });
    }

    const selectedPlatforms: string[] = platforms?.length ? platforms : ['instagram', 'threads', 'linkedin'];

    const { data: persona } = await supabase.from('brand_personas').select('*').limit(1).maybeSingle();

    const slideText = slides
      .map((s: { title?: string; body?: string }, i: number) =>
        `[${i === 0 ? '표지' : `${i + 1}장`}] ${s.title || ''}\n${s.body || ''}`
      )
      .join('\n\n');

    const personaContext = persona ? `[브랜드 페르소나] 브랜드명: ${persona.brand_name}, 톤: ${persona.tone}, 타겟: ${persona.target_audience}, 업종: ${persona.industry}, 키워드: ${(persona.keywords || []).join(', ')}` : '';

    const platformInstructions = selectedPlatforms
      .map(p => `- ${p.toUpperCase()}: ${PLATFORM_GUIDES[p] || '플랫폼 최적화'}`)
      .join('\n');

    const resultKeys = selectedPlatforms.map(p => `"${p}": { "caption": "...", "hashtags": "..." }`).join(',\n  ');

    const prompt = `다음 카드뉴스 내용으로 각 SNS 플랫폼에 최적화된 캡션을 생성하세요.
${personaContext}

카드뉴스 내용:
${slideText}

플랫폼별 요구사항:
${platformInstructions}

반드시 아래 JSON 형식으로만 응답하세요:
{
  ${resultKeys}
}`;

    let text = await generateWithRetry(prompt);
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const data = JSON.parse(text);
    return NextResponse.json({ captions: data });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
