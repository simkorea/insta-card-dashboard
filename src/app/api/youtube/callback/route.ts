import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { YOUTUBE_REDIRECT_URI, youtubeClient, toKoreanGoogleError } from '@/lib/youtube/token';

const BASE_URL = 'https://insta-card-dashboard.vercel.app';

const fail = (msg: string) =>
  NextResponse.redirect(`${BASE_URL}/sns-settings?youtube=error&msg=${encodeURIComponent(msg)}`);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');
  const state = request.nextUrl.searchParams.get('state');

  if (error || !code) {
    return fail(error === 'access_denied' ? '권한 요청을 취소했습니다.' : (error || '인증 코드를 받지 못했습니다.'));
  }

  const expected = request.cookies.get('yt_oauth_state')?.value;
  if (!expected || expected !== state) {
    return fail('인증 요청이 만료됐거나 올바르지 않습니다. 다시 시도해주세요.');
  }

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${BASE_URL}/login?next=/sns-settings`);

    const client = youtubeClient();
    if (!client) return fail('YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET 환경변수가 없습니다.');

    // 1) 코드 → 토큰
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: YOUTUBE_REDIRECT_URI,
        grant_type: 'authorization_code',
        code,
      }),
    });
    const token = await tokenRes.json();
    if (token.error) return fail(toKoreanGoogleError(token.error, token.error_description));

    // refresh token이 없으면 지금은 올릴 수 있어도 1시간 뒤엔 못 올린다.
    // 반쯤 된 상태로 "연동 완료"라고 하지 않는다.
    if (!token.refresh_token) {
      return fail(
        '갱신 토큰(refresh token)이 오지 않았습니다. 구글 계정 설정 → 보안 → 서드파티 앱에서 이 앱의 권한을 삭제한 뒤 다시 연결해주세요.'
      );
    }

    // 2) 채널 정보 (어느 채널에 올라가는지 화면에 보여주기 위해)
    const chRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    );
    const ch = await chRes.json();
    const channel = ch.items?.[0];
    if (!channel) {
      return fail(
        ch.error?.message
          ? `채널 조회 실패: ${ch.error.message}`
          : '이 구글 계정에 연결된 유튜브 채널이 없습니다. 채널을 먼저 만들어주세요.'
      );
    }

    // 3) 저장. 액세스 토큰은 1시간이면 죽으므로 refresh token이 본체다.
    await supabase.from('sns_accounts').upsert(
      {
        user_id: user.id,
        platform: 'youtube',
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        platform_user_id: channel.id,
        username: channel.snippet?.title || '',
        extra: { scope: token.scope || '' },
      },
      { onConflict: 'user_id,platform' }
    );

    const res = NextResponse.redirect(
      `${BASE_URL}/sns-settings?youtube=connected&user=${encodeURIComponent(channel.snippet?.title || '')}`
    );
    res.cookies.delete('yt_oauth_state');
    return res;
  } catch (e: any) {
    return fail(e?.message || '알 수 없는 오류');
  }
}
