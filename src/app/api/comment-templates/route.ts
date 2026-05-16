import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export async function GET() {
  const { data, error } = await supabase
    .from('comment_templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'generate') {
      const { data: persona } = await supabase.from('brand_personas').select('*').limit(1).maybeSingle();

      const personaCtx = persona ? `브랜드: ${persona.brand_name}, 톤: ${persona.tone}, 업종: ${persona.industry}` : '';

      const prompt = `SNS 댓글 관리를 위한 답변 템플릿을 생성해주세요.
${personaCtx}

아래 5가지 카테고리별로 각 3개씩, 총 15개 템플릿을 생성하세요:
1. general - 일반 감사 답변 (좋아요, 유익해요 등 긍정 댓글)
2. sales - 세일즈 전환 답변 (제품/서비스 문의 댓글)
3. dm_invite - DM 유도 답변 (상세 문의, 협업 제안 등)
4. negative - 부정적 댓글 답변 (불만, 비판 등)
5. question - 질문 답변 (정보 요청 댓글)

반드시 아래 JSON 형식으로만 응답하세요:
{
  "templates": [
    { "category": "general", "title": "기본 감사 인사", "content": "답변 내용", "tags": ["감사"] }
  ]
}

각 템플릿은 50-150자, 자연스럽고 진정성 있게, {이름} 같은 변수 자리표시자 활용 가능`;

      const result = await model.generateContent(prompt);
      let text = result.response.text();
      if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
      else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();
      const generated = JSON.parse(text);
      return NextResponse.json(generated);
    }

    // 새 템플릿 저장
    const { category, title, content, tags } = body;
    const { data, error } = await supabase
      .from('comment_templates')
      .insert({ category, title, content, tags: tags ?? [] })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ template: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
  const { error } = await supabase.from('comment_templates').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
