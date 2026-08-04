// 구글 OAuth 토큰 처리.
//
// 유튜브 액세스 토큰은 1시간이면 만료된다. 그래서 저장하는 건 refresh token이고,
// 업로드할 때마다 액세스 토큰을 새로 받는다. (인스타는 60일짜리 장기 토큰을
// 그대로 저장하는 방식이라 구조가 다르다.)

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ');

export const YOUTUBE_REDIRECT_URI =
  'https://insta-card-dashboard.vercel.app/api/youtube/callback';

export function youtubeClient() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** 구글 오류 코드를 한국어 안내로. 원문도 함께 남긴다. */
export function toKoreanGoogleError(error?: string, description?: string): string {
  const raw = [error, description].filter(Boolean).join(' — ');
  switch (error) {
    case 'invalid_grant':
      return `유튜브 인증이 만료됐습니다. SNS 설정에서 다시 연결해주세요. (${raw})`;
    case 'invalid_client':
      return `유튜브 앱 설정(CLIENT_ID/SECRET)이 올바르지 않습니다. (${raw})`;
    case 'redirect_uri_mismatch':
      return `구글 클라우드 콘솔에 등록된 리디렉션 주소가 다릅니다. ${YOUTUBE_REDIRECT_URI} 를 등록해주세요.`;
    default:
      return raw || '구글 인증에 실패했습니다.';
  }
}

/**
 * refresh token → 액세스 토큰.
 * 실패하면 던지지 않고 이유를 돌려준다 — 호출부가 한국어 메시지를 그대로 쓴다.
 */
export async function getYoutubeAccessToken(
  refreshToken: string
): Promise<{ token?: string; error?: string }> {
  const client = youtubeClient();
  if (!client) return { error: '유튜브 앱 설정(YOUTUBE_CLIENT_ID/SECRET)이 없습니다.' };

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    return { error: toKoreanGoogleError(data.error, data.error_description) };
  }
  return { token: data.access_token as string };
}
