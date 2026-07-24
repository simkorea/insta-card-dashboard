import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { toKoreanError } from '@/lib/gemini';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from('dm_automation_rules')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  return NextResponse.json({ items: data });
}

// 규칙은 항상 비활성 상태로 생성됨 — 사람이 검토 후 직접 켜야만 실제로 자동 발송이 시작됨
export async function POST(request: NextRequest) {
  try {
    const { keyword, dmMessage, commentReply } = await request.json();
    if (!keyword?.trim() || !dmMessage?.trim()) {
      return NextResponse.json({ error: '키워드와 DM 메시지는 필수입니다' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('dm_automation_rules')
      .insert({
        keyword: keyword.trim(),
        dm_message: dmMessage.trim(),
        comment_reply: commentReply?.trim() || null,
        is_active: false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ item: data });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
