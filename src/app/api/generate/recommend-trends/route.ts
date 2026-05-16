import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export async function GET() {
  try {
    const prompt = `현재 한국에서 인스타그램, 유튜브, 네이버 등 SNS에서 인기있는 트렌드 키워드 7개를 추천해 주세요.
주로 부동산, 경제, 라이프스타일, 마케팅, 기술, 자기계발 분야에서 카드뉴스로 만들기 좋은 주제여야 합니다.
2025-2026년 트렌드를 반영해주세요.

응답은 반드시 JSON 배열 형태로만 하세요. 예: ["키워드1", "키워드2", ...]`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const trends = JSON.parse(text);
    return NextResponse.json({ trends });
  } catch (error: any) {
    const fallback = ['2026 부동산 전망', 'AI 업무 자동화', '퍼스널 브랜딩', '건강한 식습관', '주간 경제 뉴스', 'MZ세대 소비 트렌드', '인스타그램 알고리즘'];
    return NextResponse.json({ trends: fallback });
  }
}
