import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

const BASE_URL = 'https://insta-card-dashboard.vercel.app';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${BASE_URL}/sns-settings?instagram=error&msg=${error || 'no_code'}`);
  }

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${BASE_URL}/login?next=/sns-settings`);
    }

    // 1. 코드 → 단기 액세스 토큰
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID!,
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: `${BASE_URL}/api/instagram/callback`,
        code,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      const msg = encodeURIComponent(JSON.stringify(tokenData));
      return NextResponse.redirect(`${BASE_URL}/sns-settings?instagram=error&msg=${msg}`);
    }

    const shortToken = tokenData.access_token as string;

    // 2. 장기 토큰으로 교환 (60일)
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${shortToken}`
    );
    const longData = await longRes.json();
    const accessToken = (longData.access_token as string) || shortToken;

    // 3. /me로 user ID + 유저명 조회
    const profileRes = await fetch(
      `https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${accessToken}`
    );
    const profile = await profileRes.json();
    const username = (profile.username as string) || '';
    const igUserId = (profile.id as string) || String(tokenData.user_id);

    // 4. sns_accounts에 해당 유저의 instagram 저장 (upsert)
    await supabase
      .from('sns_accounts')
      .upsert(
        { user_id: user.id, platform: 'instagram', access_token: accessToken, platform_user_id: igUserId, username },
        { onConflict: 'user_id,platform' }
      );

    return NextResponse.redirect(`${BASE_URL}/sns-settings?instagram=connected&user=${username}`);
  } catch (e: any) {
    return NextResponse.redirect(`${BASE_URL}/sns-settings?instagram=error&msg=${encodeURIComponent(e.message)}`);
  }
}
