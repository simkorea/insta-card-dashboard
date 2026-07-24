import { NextRequest, NextResponse } from 'next/server';
import { generateReplyDrafts } from '@/lib/comments/generateReplyDrafts';
import { toKoreanError } from '@/lib/gemini';

// 외부 서비스(카카오톡 자동 메시지 프로그램 등)에서 로그인 세션 없이 호출하는 전용 엔드포인트.
// middleware.ts의 세션 인증 대상이 아니므로, 여기서 직접 서비스 키를 검증한다.
export async function POST(request: NextRequest) {
  const key = request.headers.get('x-service-key');
  if (!key || key !== process.env.KAKAO_SERVICE_API_KEY) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const comment: string = body.comment;
    const brandName: string | undefined = body.brandName;

    if (!comment || !comment.trim()) {
      return NextResponse.json({ error: 'comment가 필요합니다' }, { status: 400 });
    }

    const replies = await generateReplyDrafts({ comment, tone: body.tone, brandName });
    return NextResponse.json({ replies });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
