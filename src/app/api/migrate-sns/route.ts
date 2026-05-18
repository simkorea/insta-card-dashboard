import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const results: Record<string, string> = {};

  // Threads
  if (process.env.THREADS_ACCESS_TOKEN && process.env.THREADS_USER_ID) {
    const { error } = await supabase.from('sns_accounts').upsert({
      user_id: user.id,
      platform: 'threads',
      access_token: process.env.THREADS_ACCESS_TOKEN,
      platform_user_id: process.env.THREADS_USER_ID,
    }, { onConflict: 'user_id,platform' });
    results.threads = error ? `실패: ${error.message}` : '연결 완료';
  }

  // TikTok
  if (process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_OPEN_ID) {
    const extra: Record<string, string> = {};
    if (process.env.TIKTOK_CLIENT_KEY) extra.client_key = process.env.TIKTOK_CLIENT_KEY;
    if (process.env.TIKTOK_CLIENT_SECRET) extra.client_secret = process.env.TIKTOK_CLIENT_SECRET;
    const { error } = await supabase.from('sns_accounts').upsert({
      user_id: user.id,
      platform: 'tiktok',
      access_token: process.env.TIKTOK_ACCESS_TOKEN,
      platform_user_id: process.env.TIKTOK_OPEN_ID,
      refresh_token: process.env.TIKTOK_REFRESH_TOKEN,
      extra,
    }, { onConflict: 'user_id,platform' });
    results.tiktok = error ? `실패: ${error.message}` : '연결 완료';
  }

  return NextResponse.json({ success: true, results });
}
