import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { originalText, templateTitle, slideCount } = await request.json();
    if (!originalText) {
      return NextResponse.json({ error: 'Original text is required' }, { status: 400 });
    }

    const countInstruction = slideCount === 'auto'
      ? '내용에 맞게 적절한 장수(최대 10장)로 구성해 주세요.'
      : `반드시 정확히 ${slideCount}장으로 구성해 주세요.`;

    const prompt = `당신은 탁월한 카드뉴스 에디터입니다.
사용자가 작성한 원본 글을 선택한 카드뉴스 템플릿의 분위기와 장수(Slide) 제한에 맞게 최적화하여 요약 및 재구성해 주세요.

[원본 글]
${originalText}

[템플릿 정보]
- 템플릿 제목/스타일: ${templateTitle || '일반 카드뉴스'}
- 슬라이드(장수) 설정: ${countInstruction}

[요구사항]
1. 원본 글의 핵심 메시지를 잃지 않으면서 간결하게 압축할 것.
2. 각 장은 반드시 [1장], [2장]과 같이 명확한 말머리로 구분할 것. (예: [1장 표지], [2장 본문])
3. 글자 수 제한: 각 슬라이드별로 들어갈 텍스트는 3문장을 넘지 않고, 총 100자 이내로 매우 직관적으로 작성할 것.
4. 불필요한 인사말, 해설 없이 화면에 바로 붙여넣어 사용할 수 있는 대본 텍스트만 출력할 것.`;

    const text = await generateWithRetry(prompt);
    return NextResponse.json({ text });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
