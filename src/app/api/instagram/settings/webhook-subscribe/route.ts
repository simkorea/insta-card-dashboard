import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAccount() {
  const { data: account } = await supabase
    .from('sns_accounts')
    .select('access_token, platform_user_id')
    .eq('platform', 'instagram')
    .limit(1)
    .maybeSingle();
  return account;
}

// 현재 이 IG 계정이 앱의 웹훅(comments/messages)을 구독 중인지 확인
export async function GET() {
  const account = await getAccount();
  if (!account?.access_token || !account.platform_user_id) {
    return NextResponse.json({ error: '연결된 인스타그램 계정이 없습니다.' }, { status: 400 });
  }

  const res = await fetch(
    `https://graph.instagram.com/v21.0/${account.platform_user_id}/subscribed_apps?access_token=${account.access_token}`
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.ok ? 200 : 502 });
}

// comments, messages 필드에 대해 이 IG 계정을 앱 웹훅에 구독시킴 (최초 1회 필요)
export async function POST() {
  const account = await getAccount();
  if (!account?.access_token || !account.platform_user_id) {
    return NextResponse.json({ error: '연결된 인스타그램 계정이 없습니다.' }, { status: 400 });
  }

  const res = await fetch(
    `https://graph.instagram.com/v21.0/${account.platform_user_id}/subscribed_apps?subscribed_fields=comments,messages&access_token=${account.access_token}`,
    { method: 'POST' }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.ok ? 200 : 502 });
}
