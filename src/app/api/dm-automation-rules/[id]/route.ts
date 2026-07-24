import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { toKoreanError } from '@/lib/gemini';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof body.isActive === 'boolean') update.is_active = body.isActive;
    if (typeof body.keyword === 'string') update.keyword = body.keyword.trim();
    if (typeof body.dmMessage === 'string') update.dm_message = body.dmMessage.trim();
    if (typeof body.commentReply === 'string') update.comment_reply = body.commentReply.trim() || null;

    const { data, error } = await supabase
      .from('dm_automation_rules')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ item: data });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabase.from('dm_automation_rules').delete().eq('id', id);
  if (error) return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  return NextResponse.json({ success: true });
}
