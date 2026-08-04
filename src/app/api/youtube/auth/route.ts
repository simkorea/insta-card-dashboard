import { NextResponse } from 'next/server';
import { YOUTUBE_SCOPES, YOUTUBE_REDIRECT_URI, youtubeClient } from '@/lib/youtube/token';

const BASE_URL = 'https://insta-card-dashboard.vercel.app';

export async function GET() {
  const client = youtubeClient();
  if (!client) {
    return NextResponse.redirect(
      `${BASE_URL}/sns-settings?youtube=error&msg=${encodeURIComponent('YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET 환경변수가 없습니다.')}`
    );
  }

  // 콜백이 진짜 우리가 시작한 인증인지 확인하기 위한 값.
  // 이 라우트는 토큰을 계정에 연결하므로, 남이 유도한 콜백으로
  // 엉뚱한 채널이 붙는 일을 막는다.
  const state = crypto.randomUUID();

  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: client.clientId,
      redirect_uri: YOUTUBE_REDIRECT_URI,
      response_type: 'code',
      scope: YOUTUBE_SCOPES,
      // refresh token은 offline + consent를 함께 줘야 매번 확실히 내려온다.
      // prompt를 빼면 두 번째 연결부터 refresh token이 오지 않아
      // "연동은 됐는데 업로드가 안 되는" 상태가 된다.
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    }).toString();

  const res = NextResponse.redirect(authUrl);
  res.cookies.set('yt_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
