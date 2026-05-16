import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TYPE_GUIDE: Record<string, string> = {
  welcome: '새 팔로워 환영 DM — 따뜻하고 진정성 있게, 억지스럽지 않게',
  followup: '댓글/좋아요에 감사하는 팔로업 DM — 대화를 자연스럽게 이어가기',
  collab: '협업/컨택 제안 DM — 전문적이고 매력적으로, 명확한 제안 포함',
  purchase: '구매 전환 유도 DM — 부드럽게 가치 전달, 부담 없는 CTA',
  support: '팔로워 응원/감사 DM — 관계 강화, 충성도 높이기',
};

export async function POST(request: Request) {
  try {
    const { type, recipientName, recipientInfo, tone } = await request.json();
    if (!type) return NextResponse.json({ error: 'type이 필요합니다' }, { status: 400 });

    const { data: persona } = await supabase.from('brand_personas').select('*').limit(1).maybeSingle();

    const brandCtx = persona
      ? `내 브랜드: ${persona.brand_name} / 업종: ${persona.industry} / 톤: ${tone || persona.tone}`
      : tone ? `톤: ${tone}` : '';

    const prompt = `인스타그램 DM 메시지 3가지 버전을 생성해주세요.

DM 목적: ${TYPE_GUIDE[type] || type}
${recipientName ? `수신자 이름: ${recipientName}` : ''}
${recipientInfo ? `수신자 정보/특징: ${recipientInfo}` : ''}
${brandCtx}

3가지 버전을 다른 스타일로 작성하세요:
1. 짧고 임팩트 있게 (50-80자)
2. 친근하고 대화체로 (100-150자)
3. 전문적이고 상세하게 (150-200자)

규칙:
- 자연스러운 한국어 구어체
- 영업처럼 보이지 않게
- {이름} 변수 사용 가능
- 이모지 1-2개 이내

반드시 아래 JSON으로만 응답:
{
  "versions": [
    { "style": "짧고 임팩트", "content": "..." },
    { "style": "친근 대화체", "content": "..." },
    { "style": "전문 상세형", "content": "..." }
  ]
}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
