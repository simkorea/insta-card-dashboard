import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { cards, tone, brand_name, industry } = await req.json() as {
      cards: { title: string; body: string }[];
      tone?: string;
      brand_name?: string;
      industry?: string;
    };

    if (!cards?.length) return NextResponse.json({ error: 'cards 필드가 없습니다' }, { status: 400 });

    const cardText = cards.map((c, i) => `[${i + 1}/${cards.length}] 제목: ${c.title}\n내용: ${c.body}`).join('\n\n');
    const toneMap: Record<string, string> = {
      friendly: '친근하고 편안한',
      professional: '전문적이고 신뢰감 있는',
      trendy: '트렌디하고 감각적인',
      emotional: '감성적이고 따뜻한',
      humorous: '유머러스하고 재치 있는',
      authoritative: '권위 있고 믿음직한',
    };
    const toneDesc = toneMap[tone || 'friendly'] || '친근하고 편안한';

    const systemPrompt = `당신은 인스타그램 마케터입니다. 카드뉴스 내용을 바탕으로 인스타그램 캡션을 작성해 주세요.

규칙:
- 톤: ${toneDesc}
- 브랜드: ${brand_name || ''}
- 업종: ${industry || ''}
- 캡션 길이: 150~300자
- 줄바꿈을 활용해 읽기 쉽게 구성
- 마지막에 관련 해시태그 15~20개 포함 (줄바꿈 후 # 시작)
- 첫 줄은 눈길을 끄는 훅(hook) 문장으로 시작
- 이모지 적절히 사용
- JSON 형식으로 반환: { "caption": "...", "hashtags": ["tag1", "tag2", ...] }`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `아래 카드뉴스 내용으로 인스타그램 캡션을 만들어 주세요:\n\n${cardText}`,
        },
      ],
    });

    const raw = (message.content[0] as { type: string; text: string }).text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: '파싱 실패' }, { status: 500 });
    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ caption: parsed.caption, hashtags: parsed.hashtags ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
