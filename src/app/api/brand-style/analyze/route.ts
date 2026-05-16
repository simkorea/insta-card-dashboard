import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export async function POST(request: Request) {
  try {
    const { images } = await request.json();
    if (!images || images.length === 0) {
      return NextResponse.json({ error: '이미지가 필요합니다' }, { status: 400 });
    }

    const textPrompt = `다음 카드뉴스 디자인 이미지를 분석해서 브랜드 스타일을 추출해주세요.

반드시 아래 JSON으로만 응답하세요:
{
  "primaryColor": "#hex (가장 dominant한 브랜드 색상)",
  "accentColor": "#hex (포인트 색상)",
  "bgStyle": "dark|light|gradient (배경 스타일)",
  "fontStyle": "bold|elegant|minimal|playful (폰트 무드)",
  "mood": "professional|casual|luxury|energetic|minimal (전체 분위기)",
  "overlayStrength": "strong|medium|light (텍스트 가독성을 위한 오버레이 강도)",
  "layoutStyle": "center|bottom-left|asymmetric (레이아웃 패턴)",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "description": "이 디자인 스타일을 한국어로 2-3문장 설명"
}`;

    const imageParts = images.slice(0, 5).map((dataUrl: string) => {
      const [meta, data] = dataUrl.split(',');
      const mimeType = (meta.match(/data:(.*?);/)?.[1] ?? 'image/jpeg') as string;
      return { inlineData: { mimeType, data } };
    });

    const result = await model.generateContent([textPrompt, ...imageParts]);
    let text = result.response.text();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const profile = JSON.parse(text);
    return NextResponse.json({ profile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
