import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

async function getAuthUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getAuthUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const { data, error } = await supabase
    .from('sns_accounts')
    .select('platform_user_id, username, created_at')
    .eq('user_id', user.id)
    .eq('platform', 'instagram')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    settings: data ? { ig_user_id: data.platform_user_id, username: data.username } : null,
  });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const { access_token, ig_user_id } = await request.json();
  if (!access_token || !ig_user_id) {
    return NextResponse.json({ error: 'access_token과 ig_user_id가 필요합니다' }, { status: 400 });
  }

  let username = '';
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${ig_user_id}?fields=username&access_token=${access_token}`
    );
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: `토큰 오류: ${data.error.message}` }, { status: 400 });
    username = data.username || '';
  } catch {
    return NextResponse.json({ error: 'Instagram API 연결 실패' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('sns_accounts')
    .upsert(
      { user_id: user.id, platform: 'instagram', access_token, platform_user_id: ig_user_id, username },
      { onConflict: 'user_id,platform' }
    )
    .select('platform_user_id, username')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: { ig_user_id: data.platform_user_id, username: data.username }, username });
}

export async function DELETE() {
  const { supabase, user } = await getAuthUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const { error } = await supabase
    .from('sns_accounts')
    .delete()
    .eq('user_id', user.id)
    .eq('platform', 'instagram');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
