import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from('instagram_settings')
    .select('id, ig_user_id, username, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function POST(request: NextRequest) {
  const { access_token, ig_user_id } = await request.json();
  if (!access_token || !ig_user_id) {
    return NextResponse.json({ error: 'access_token과 ig_user_id가 필요합니다' }, { status: 400 });
  }

  // Instagram Graph API로 유효성 검증 + 유저명 조회
  let username = '';
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${ig_user_id}?fields=username&access_token=${access_token}`
    );
    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: `토큰 오류: ${data.error.message}` }, { status: 400 });
    }
    username = data.username || '';
  } catch {
    return NextResponse.json({ error: 'Instagram API 연결 실패' }, { status: 500 });
  }

  // 기존 설정 삭제 후 새로 저장
  await supabase.from('instagram_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { data, error } = await supabase
    .from('instagram_settings')
    .insert({ access_token, ig_user_id, username })
    .select('id, ig_user_id, username')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data, username });
}
