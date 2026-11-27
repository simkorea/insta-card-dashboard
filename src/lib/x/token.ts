/**
 * X(Twitter) API OAuth 2.0 설정.
 *
 * 2026-02부터 X API는 종량제(PPU)로 바뀌어 Free 플랜이 없다.
 * 게시·미디어 업로드는 user-context 토큰(OAuth 2.0 Authorization Code + PKCE)이
 * 필요하고, 액세스 토큰 수명이 2시간이라 refresh token을 함께 저장해야 한다.
 *
 * 필요한 환경변수:
 *   X_CLIENT_ID      — X 개발자 콘솔 앱의 OAuth 2.0 Client ID
 *   X_CLIENT_SECRET  — 같은 앱의 Client Secret
 *   X_REDIRECT_URI   — 기본값 https://insta-card-dashboard.vercel.app/api/x/callback
 *                      (로컬 테스트 시에만 http://localhost:3000/api/x/callback)
 */

export const X_API = 'https://api.x.com';
export const X_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
export const X_TOKEN_URL = `${X_API}/2/oauth2/token`;

export const X_REDIRECT_URI =
  process.env.X_REDIRECT_URI || 'https://insta-card-dashboard.vercel.app/api/x/callback';

// media.write: v2 미디어 업로드(이미지·영상)에 필요
// offline.access: refresh token 발급
export const X_SCOPES = 'tweet.read tweet.write users.read media.write offline.access';

export function xClient(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** confidential client의 토큰 요청은 Basic 인증을 쓴다. */
export function xBasicAuth(client: { clientId: string; clientSecret: string }): string {
  return 'Basic ' + Buffer.from(`${client.clientId}:${client.clientSecret}`).toString('base64');
}

/** 앱에 연결된 X 계정이 없을 때 화면에 그대로 보여줄 안내. */
export const X_ENV_MISSING_MESSAGE =
  'X_CLIENT_ID / X_CLIENT_SECRET 환경변수가 없습니다. Vercel 프로젝트 설정 → Environment Variables에 등록한 뒤 다시 시도해주세요.';

/**
 * refresh token으로 액세스 토큰을 새로 받는다.
 * X는 갱신할 때마다 refresh token을 새로 내려줄 수 있어서, 받은 값은 반드시 저장해야 한다.
 */
export async function refreshXToken(refreshToken: string): Promise<
  | { ok: true; accessToken: string; refreshToken?: string; expiresIn?: number }
  | { ok: false; error: string }
> {
  const client = xClient();
  if (!client) return { ok: false, error: X_ENV_MISSING_MESSAGE };

  try {
    const res = await fetch(X_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: xBasicAuth(client),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: client.clientId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error || !data.access_token) {
      const reason = data.error_description || data.error || `HTTP ${res.status}`;
      return { ok: false, error: `X 토큰 갱신 실패: ${reason}` };
    }
    return {
      ok: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (e: any) {
    return { ok: false, error: `X 토큰 갱신 오류: ${e?.message || '네트워크 오류'}` };
  }
}

/** X가 돌려주는 오류를 화면에 보여줄 한국어 문장으로 바꾼다. */
export function toKoreanXError(status: number, body: any): string {
  const detail =
    body?.detail ||
    body?.error_description ||
    body?.errors?.[0]?.detail ||
    body?.errors?.[0]?.message ||
    body?.title ||
    body?.error ||
    '';
  if (status === 401) return 'X 인증이 만료되었습니다. SNS 설정에서 X 계정을 다시 연동해주세요.';
  if (status === 403 && /credit|payment|billing|spend/i.test(String(detail))) {
    return 'X API 크레딧이 부족합니다. console.x.com → Credits에서 충전한 뒤 다시 시도해주세요.';
  }
  if (status === 403 && /too long|character limit|exceeds/i.test(String(detail))) {
    return `X 글자 수 제한을 넘었습니다: ${detail}`;
  }
  if (status === 429) return 'X API 요청 한도를 넘었습니다. 잠시 후 다시 시도해주세요.';
  return `X API 오류(${status})${detail ? `: ${detail}` : ''}`;
}
