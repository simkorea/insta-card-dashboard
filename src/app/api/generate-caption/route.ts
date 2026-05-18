import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { cards, tone, brand_name, industry } = await req.json() as {
      cards: { title: string; body: string }[];
      tone?: string;
      brand_name?: string;
      industry?: string;
    };

    if (!cards?.length) return NextResponse.json({ error: 'cards 필드가 없습니다' }, { status: 400 });

    const cardText = cards.map((c, i) =>
      `[${i + 1}/${cards.length}] 제목: ${c.title}${c.body ? `\n내용: ${c.body}` : ''}`
    ).join('\n\n');

    const toneMap: Record<string, string> = {
      friendly: '친근하고 편안한',
      professional: '전문적이고 신뢰감 있는',
      trendy: '트렌디하고 감각적인',
      emotional: '감성적이고 따뜻한',
      humorous: '유머러스하고 재치 있는',
      authoritative: '권위 있고 믿음직한',
    };
    const toneDesc = toneMap[tone || 'professional'] || '전문적이고 신뢰감 있는';

    const prompt = `당신은 인스타그램 마케터입니다. 아래 카드뉴스 내용을 바탕으로 인스타그램 캡션과 해시태그를 작성하세요.

카드뉴스 내용:
${cardText}

작성 규칙:
- 톤: ${toneDesc}
${brand_name ? `- 브랜드/계정명: ${brand_name}` : ''}
${industry ? `- 업종: ${industry}` : ''}
- 첫 줄: 핵심 정보나 수치를 담은 강렬한 훅 문장 (예: "내 대출 한도 얼마나 줄었는지 알고 계신가요?")
- 본문: 카드뉴스의 핵심 내용 2~4문장으로 요약, 구체적 수치/날짜 포함
- 마지막: "저장해두고 꺼내보세요 💡" 또는 행동 유도 문구
- 이모지 적절히 사용, 자연스러운 줄바꿈
- 전체 캡션 150~300자
- 해시태그: 주제에 딱 맞는 한국어 해시태그 20~30개 (일반 인기태그 + 주제 특화 태그 혼합)

반드시 JSON만 응답하세요 (코드블록 없이):
{
  "caption": "캡션 본문 (해시태그 제외)",
  "hashtags": ["태그1", "태그2", "태그3", ...]
}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const parsed = JSON.parse(text);
    return NextResponse.json({
      caption: parsed.caption || '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map((t: string) => t.replace(/^#/, '')) : [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
