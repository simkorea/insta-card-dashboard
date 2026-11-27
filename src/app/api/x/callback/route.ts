import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import {
  X_API,
  X_ENV_MISSING_MESSAGE,
  X_REDIRECT_URI,
  X_TOKEN_URL,
  xBasicAuth,
  xClient,
} from '@/lib/x/token';

const BASE_URL = 'https://insta-card-dashboard.vercel.app';

const failX = (msg: string) =>
  NextResponse.redirect(`${BASE_URL}/sns-settings?x=error&msg=${encodeURIComponent(msg)}`);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');
  const state = request.nextUrl.searchParams.get('state');

  if (error || !code) {
    return failX(
      error === 'access_denied'
        ? '권한 요청을 취소했습니다.'
        : error || 'X 인증 코드를 받지 못했습니다.'
    );
  }

  const expectedState = request.cookies.get('x_oauth_state')?.value;
  const verifier = request.cookies.get('x_oauth_verifier')?.value;
  if (!expectedState || expectedState !== state || !verifier) {
    return failX('인증 요청이 만료됐거나 올바르지 않습니다. 다시 시도해주세요.');
  }

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${BASE_URL}/login?next=/sns-settings`);

    const client = xClient();
    if (!client) return failX(X_ENV_MISSING_MESSAGE);

    // 1) code → token
    const tokenRes = await fetch(X_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: xBasicAuth(client),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: client.clientId,
        redirect_uri: X_REDIRECT_URI,
        code_verifier: verifier,
      }),
    });
    const token = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || token.error || !token.access_token) {
      return failX(
        `토큰 발급 실패: ${token.error_description || token.error || `HTTP ${tokenRes.status}`}`
      );
    }

    // refresh token이 없으면 2시간 뒤 발행이 멈춘다. 반쯤 된 연동으로 "완료"라고 하지 않는다.
    if (!token.refresh_token) {
      return failX(
        '갱신 토큰(refresh token)이 오지 않았습니다. X 계정 설정 → 보안 및 계정 접근 → 앱 및 세션에서 이 앱의 권한을 삭제한 뒤 다시 연동해주세요.'
      );
    }

    // 2) 어느 계정에 연결됐는지 확인 (화면 표시 + 게시물 링크에 사용)
    const meRes = await fetch(`${X_API}/2/users/me`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const me = await meRes.json().catch(() => ({}));
    const account = me?.data;
    if (!meRes.ok || !account?.id) {
      return failX(
        me?.detail || me?.title
          ? `X 계정 조회 실패: ${me.detail || me.title}`
          : '연결된 X 계정 정보를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.'
      );
    }

    // 3) 저장. access token은 2시간이면 만료되므로 refresh token과 만료 시각을 같이 둔다.
    const expiresAt = token.expires_in
      ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
      : undefined;

    const { error: dbError } = await supabase.from('sns_accounts').upsert(
      {
        user_id: user.id,
        platform: 'x',
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        platform_user_id: String(account.id),
        username: account.username || '',
        extra: {
          scope: token.scope || '',
          token_type: token.token_type || 'bearer',
          ...(expiresAt ? { expires_at: expiresAt } : {}),
        },
      },
      { onConflict: 'user_id,platform' }
    );
    if (dbError) return failX(`연동 정보 저장 실패: ${dbError.message}`);

    const res = NextResponse.redirect(
      `${BASE_URL}/sns-settings?x=connected&user=${encodeURIComponent(account.username || '')}`
    );
    res.cookies.delete('x_oauth_state');
    res.cookies.delete('x_oauth_verifier');
    return res;
  } catch (e: any) {
    return failX(e?.message || '알 수 없는 오류');
  }
}
