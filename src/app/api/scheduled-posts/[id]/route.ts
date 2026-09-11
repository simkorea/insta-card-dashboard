import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// scheduled_posts 는 서버 전용이다 (service role).
// 키가 없다고 anon 으로 넘어가지 않는다. RLS 를 닫은 뒤에는 anon 이
// 아무 행도 못 바꿔서, 취소가 안 된 것을 아무도 모르게 된다.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabase.from('scheduled_posts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { error } = await supabase.from('scheduled_posts').update(body).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
