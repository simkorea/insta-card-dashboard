import crypto from 'crypto';
import { NextResponse } from 'next/server';
import {
  X_AUTHORIZE_URL,
  X_ENV_MISSING_MESSAGE,
  X_REDIRECT_URI,
  X_SCOPES,
  xClient,
} from '@/lib/x/token';

const BASE_URL = 'https://insta-card-dashboard.vercel.app';

const base64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * X OAuth 2.0 (Authorization Code + PKCE) 시작.
 *
 * PKCE를 쓰는 이유: X의 user-context 토큰은 이 방식만 지원하고,
 * code_verifier를 아는 이 브라우저만 토큰으로 바꿀 수 있어 콜백 탈취를 막는다.
 */
export async function GET() {
  const client = xClient();
  if (!client) {
    return NextResponse.redirect(
      `${BASE_URL}/sns-settings?x=error&msg=${encodeURIComponent(X_ENV_MISSING_MESSAGE)}`
    );
  }

  const state = crypto.randomUUID();
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());

  const authUrl =
    X_AUTHORIZE_URL +
    '?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: client.clientId,
      redirect_uri: X_REDIRECT_URI,
      scope: X_SCOPES,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();

  const res = NextResponse.redirect(authUrl);
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600,
  };
  res.cookies.set('x_oauth_state', state, cookieOpts);
  res.cookies.set('x_oauth_verifier', verifier, cookieOpts);
  return res;
}
