import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { input, category } = await request.json().catch(() => ({}));

    if (!input && !category) {
      return NextResponse.json({ error: 'input 또는 category 필요' }, { status: 400 });
    }

    const prompt = `당신은 프로페셔널한 한국 SNS 카드뉴스 기획자입니다.
제공된 입력 정보와 카테고리를 반영하여, 2026년 현재 인스타그램, 네이버 등 SNS에서 대중의 큰 관심을 받을 만한 "구체적이고 매력적인 카드뉴스 주제 후보 6개"를 추천해주세요.

[정보]
- 자유 입력 서두: ${input || '제공되지 않음'}
- 카테고리: ${category || '제공되지 않음'}

[지침]
1. 시의성 및 최신성 극대화: 오래되거나 유행이 지난 주제는 제외하고, 2026년 현재 트렌드와 시의성에 알맞은 최신 주제로 구성하세요. 날짜가 지난 이슈나 과거 데이터는 배제합니다.
2. 구체적인 제목 형태: 단순한 키워드가 아니라, 카드뉴스 표지 제목처럼 한눈에 이목을 끄는 구체적인 제목으로 지어주세요. (예: "2026년 3기 신도시 청약 일정 총정리", "기획자가 반드시 알아야 할 이번 주 숏폼 트렌드")
3. 응답 포맷: 다른 설명이나 인사말 없이 오직 JSON 배열 형태로만 응답하세요.

예시 응답:
["주제1", "주제2", "주제3", "주제4", "주제5", "주제6"]`;

    let text = await generateWithRetry(prompt);

    if (text.includes('```json')) {
      text = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      text = text.split('```')[1].split('```')[0].trim();
    } else {
      text = text.trim();
    }

    const topics = JSON.parse(text);
    if (!Array.isArray(topics)) {
      throw new Error("AI 응답이 배열 형식이 아닙니다.");
    }

    return NextResponse.json({ topics });
  } catch (error: any) {
    console.error('[topic-suggest] 에러:', error);
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
