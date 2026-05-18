import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { keyword } = await request.json();
    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const prompt = `당신은 프로페셔널한 SNS 콘텐츠 기획자입니다.
다음 주제/키워드에 대한 트렌드, 데이터, 인사이트를 바탕으로
실제 카드뉴스 템플릿에 바로 복사/붙여넣기 할 수 있는 수준으로 완벽하게 요약해 주세요.

주제: "${keyword}"

[요구사항]
1. 최신 수치, 날짜, 사례 등을 포함할 것 (알고 있는 최신 정보 기반)
2. 딱딱하지 않고 사람들에게 인사이트를 주는 SNS 톤앤매너 유지
3. 카드뉴스 장수에 맞게 명확히 분리할 것 ([1장 표지], [2장 본문], [3장 본문], [4장 본문], [5장 결론])
4. 글자 수 제한: 각 장(슬라이드)마다 텍스트는 3문장 이내, 총 100자를 넘지 않도록 아주 간결하게 핵심만 작성할 것.
5. 불필요한 설명 없이 즉시 사용할 수 있는 대본 텍스트만 반환할 것.`;

    const text = await generateWithRetry(prompt);
    return NextResponse.json({ text });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
