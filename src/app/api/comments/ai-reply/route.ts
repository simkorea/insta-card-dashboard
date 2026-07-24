import { NextRequest, NextResponse } from 'next/server';
import { generateReplyDrafts } from '@/lib/comments/generateReplyDrafts';
import { toKoreanError } from '@/lib/gemini';

export async function POST(request: NextRequest) {
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
