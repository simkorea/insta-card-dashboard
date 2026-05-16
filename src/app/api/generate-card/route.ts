import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    const systemInstruction = `당신은 프로페셔널한 SNS 마케터이자 전문 카피라이터입니다.
사용자의 주제를 바탕으로 5장짜리 카드뉴스 기획안(카피)을 작성해야 합니다.
반드시 아래 JSON 형태로만 반환하세요. 어떤 추가 설명이나 마크다운 백틱(\`\`\`)도 포함하지 마세요.

{
  "cards": [
    { "page": 1, "title": "표지 타이틀 (짧고 강렬하게)", "body": "표지 부제목" },
    { "page": 2, "title": "본문 1 제목", "body": "본문 1 상세 내용" },
    { "page": 3, "title": "본문 2 제목", "body": "본문 2 상세 내용" },
    { "page": 4, "title": "본문 3 제목", "body": "본문 3 상세 내용" },
    { "page": 5, "title": "마지막 장 (Call To Action)", "body": "좋아요, 저장, 공유 유도 문구" }
  ]
}`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
    });

    const result = await model.generateContent(prompt);
    let rawContent = result.response.text().trim();

    if (rawContent.startsWith('```json')) {
      rawContent = rawContent.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (rawContent.startsWith('```')) {
      rawContent = rawContent.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const data = JSON.parse(rawContent);
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Error generating card news:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
