import { getYoutubeAccessToken } from './token';

// 유튜브 쇼츠 업로드.
//
// 인스타와 근본적으로 다른 점: 인스타는 영상 주소를 주면 Meta가 알아서
// 받아가지만, 유튜브는 우리가 파일 바이트를 직접 보내야 한다.
// 그래서 Supabase에서 받아 구글로 다시 올린다.

const UPLOAD_URL =
  'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';

// 쇼츠는 3분 이하라 보통 100MB를 넘지 않는다. 파일을 메모리에 담아
// 올리므로 상한을 둔다 — 넘으면 시도하다 죽는 대신 미리 알려준다.
const MAX_BYTES = 200 * 1024 * 1024;

export type YoutubePrivacy = 'public' | 'unlisted' | 'private';

export interface YoutubeUploadResult {
  success: boolean;
  url?: string;
  videoId?: string;
  error?: string;
}

export async function uploadShortToYoutube(opts: {
  refreshToken: string;
  videoUrl: string;
  title: string;
  description?: string;
  privacyStatus?: YoutubePrivacy;
}): Promise<YoutubeUploadResult> {
  const { refreshToken, videoUrl } = opts;

  const title = (opts.title || '').trim().slice(0, 100);
  if (!title) return { success: false, error: 'YouTube: 제목이 필요합니다.' };

  const { token, error: tokenErr } = await getYoutubeAccessToken(refreshToken);
  if (!token) return { success: false, error: `YouTube: ${tokenErr}` };

  // 1) 영상 내려받기
  let bytes: ArrayBuffer;
  try {
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      return { success: false, error: `YouTube: 올려둔 영상을 읽지 못했습니다 (${videoRes.status}).` };
    }
    const declared = Number(videoRes.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) {
      return {
        success: false,
        error: `YouTube: 영상이 너무 큽니다 (${Math.round(declared / 1024 / 1024)}MB). 200MB 이하로 줄여주세요.`,
      };
    }
    bytes = await videoRes.arrayBuffer();
  } catch (e: any) {
    return { success: false, error: `YouTube: 영상을 읽는 중 오류 — ${e?.message || e}` };
  }

  if (bytes.byteLength > MAX_BYTES) {
    return {
      success: false,
      error: `YouTube: 영상이 너무 큽니다 (${Math.round(bytes.byteLength / 1024 / 1024)}MB). 200MB 이하로 줄여주세요.`,
    };
  }

  // 2) 업로드 세션 열기. 실제 바이트는 응답의 Location 주소로 보낸다.
  const initRes = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(bytes.byteLength),
    },
    body: JSON.stringify({
      snippet: {
        title,
        description: (opts.description || '').slice(0, 5000),
        categoryId: '22', // People & Blogs
      },
      status: {
        privacyStatus: opts.privacyStatus || 'public',
        // 아동용 여부는 필수 신고 항목이다. 값을 안 주면 업로드가 거부될 수 있다.
        selfDeclaredMadeForKids: false,
      },
    }),
  });

  if (!initRes.ok) {
    const body = await initRes.text();
    return { success: false, error: `YouTube 업로드 준비 실패: ${describe(initRes.status, body)}` };
  }

  const session = initRes.headers.get('location');
  if (!session) return { success: false, error: 'YouTube: 업로드 주소를 받지 못했습니다.' };

  // 3) 바이트 전송
  const putRes = await fetch(session, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(bytes.byteLength) },
    body: bytes,
  });
  const result = await putRes.json().catch(() => ({}));

  if (!putRes.ok || !result.id) {
    return {
      success: false,
      error: `YouTube 업로드 실패: ${describe(putRes.status, JSON.stringify(result))}`,
    };
  }

  // 세로 영상이고 3분 이하면 유튜브가 알아서 쇼츠로 분류한다.
  // shorts/ 주소는 쇼츠가 아니어도 일반 재생으로 넘어가므로 그대로 써도 안전하다.
  return { success: true, videoId: result.id, url: `https://www.youtube.com/shorts/${result.id}` };
}

/** 구글이 돌려준 오류를 사람이 읽을 수 있게. 원문은 잘라서 붙인다. */
function describe(status: number, body: string): string {
  let reason = '';
  try {
    const parsed = JSON.parse(body);
    reason = parsed?.error?.errors?.[0]?.reason || '';
  } catch {
    /* 본문이 JSON이 아니면 그냥 원문을 쓴다 */
  }

  const known: Record<string, string> = {
    quotaExceeded: '오늘 업로드 한도를 초과했습니다. 유튜브 API 기본 한도로는 하루 약 6개까지 올릴 수 있습니다.',
    uploadLimitExceeded: '이 채널의 하루 업로드 한도를 초과했습니다.',
    youtubeSignupRequired: '이 구글 계정에 유튜브 채널이 없습니다.',
    forbidden: '권한이 없습니다. SNS 설정에서 유튜브를 다시 연결해주세요.',
    authError: '인증이 만료됐습니다. SNS 설정에서 유튜브를 다시 연결해주세요.',
    invalidVideoMetadata: '제목·설명이 유튜브 정책에 맞지 않습니다(금지 문자 등).',
  };

  if (known[reason]) return known[reason];
  return `${status} ${body.slice(0, 300)}`;
}
