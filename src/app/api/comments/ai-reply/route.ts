import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callOpenRouter } from '@/lib/ai/openrouter';
import { toKoreanError } from '@/lib/gemini';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TONE_VALUES = ['friendly', 'professional', 'careful'] as const;
type Tone = (typeof TONE_VALUES)[number];

const TONE_GUIDE: Record<Tone, string> = {
  friendly: '친근·다정한 톤 — 이웃처럼 편안하게, 이모지 1~2개 허용',
  professional: '전문·신뢰감 있는 톤 — 정확하고 단정한 어투, 이모지 절제',
  careful: '정중·신중한 톤 — 격식 있고 조심스럽게, 민감한 질문에 특히 신중하게',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const comment: string = body.comment;
    const brandName: string | undefined = body.brandName;

    if (!comment || !comment.trim()) {
      return NextResponse.json({ error: 'comment가 필요합니다' }, { status: 400 });
    }

    const tone: Tone = TONE_VALUES.includes(body.tone) ? body.tone : 'friendly';

    let exampleBlock = '';
    try {
      const { data: examples } = await supabase
        .from('comment_templates')
        .select('title, content')
        .eq('tone', tone)
        .limit(3);
      if (examples?.length) {
        exampleBlock = `\n[브랜드 기존 말투 예시 — 참고만 하고 그대로 베끼지 말 것]\n${examples
          .map((e) => `- (${e.title}) ${e.content}`)
          .join('\n')}\n`;
      }
    } catch {
      // 템플릿 조회 실패해도 생성은 계속 진행
    }

    const brandCtx = brandName ? `계정명: ${brandName}` : '계정 성격: 부동산 분양 홍보 인스타그램';

    const prompt = `너는 부동산 분양 홍보 인스타그램 계정의 댓글 담당자다. 아래 실제 댓글에 대한 답변을 작성해야 한다.

${brandCtx}
답변 톤: ${TONE_GUIDE[tone]}
${exampleBlock}
[실제 댓글]
${comment.trim()}

[반드시 지킬 규칙]
1. 분양가, 입주일, 학교 배정, 평형별 세부 조건 등 확정되지 않았거나 확인이 필요한 정보는 절대 단정해서 말하지 말 것. 이런 질문에는 "정확한 안내는 DM으로 도와드릴게요" 같은 식으로 자연스럽게 DM 유도로 연결할 것.
2. 청약 자격(1순위 여부, 무주택 요건 등)에 대해 확답하지 말 것 — 부적격 처리 위험이 있으므로 "청약 자격은 청약홈 또는 시행사 확인이 필요하다"는 취지로만 안내하고 단정적 판단은 피할 것.
3. 답변 끝에서 DM으로 자연스럽게 이어지도록 유도할 것 (억지스럽지 않게).
4. 존재하지 않는 정보를 지어내지 말 것.
5. 자연스러운 한국어 구어체, 실제 댓글 내용에 구체적으로 반응할 것 (뻔한 복붙처럼 보이지 않게).

[생성 지침]
서로 다른 3가지 버전을 작성하라:
1. "짧게" — 1~2문장, 간결하게
2. "정보 위주" — 확인 가능한 선에서 정보를 주고 나머지는 DM 유도
3. "공감 위주" — 댓글 작성자의 상황/감정에 먼저 공감한 뒤 답변

반드시 아래 JSON 형식으로만 응답하라 (다른 텍스트 없이):
{
  "replies": [
    { "text": "...", "style": "짧게" },
    { "text": "...", "style": "정보 위주" },
    { "text": "...", "style": "공감 위주" }
  ]
}`;

    let text = await callOpenRouter({ prompt, maxTokens: 4000 });
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const data = JSON.parse(text);
    return NextResponse.json({ replies: data.replies ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
