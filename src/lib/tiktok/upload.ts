// 틱톡 영상 업로드 (Content Posting API).
//
// 유튜브와 마찬가지로 바이트를 직접 보내야 한다. 틱톡에도 주소를 주면 받아가는
// PULL_FROM_URL이 있지만 그 주소의 도메인 소유권을 개발자 포털에서 인증해야 한다.
// 영상은 Supabase에 있어서 인증이 불가능하므로 FILE_UPLOAD를 쓴다.

const API = 'https://open.tiktokapis.com/v2';

// 틱톡 규격: 청크는 5MB~64MB, 마지막 청크가 나머지를 흡수한다.
const SINGLE_MAX = 64 * 1024 * 1024;
const CHUNK = 50 * 1024 * 1024;
const MAX_BYTES = 200 * 1024 * 1024; // 메모리에 담으므로 상한을 둔다

export interface TikTokAccount {
  access_token?: string | null;
  refresh_token?: string | null;
  extra?: { client_key?: string; client_secret?: string } | null;
}

export interface TikTokResult {
  success: boolean;
  url?: string;
  error?: string;
  /** 업로드는 끝났는데 틱톡 처리가 안 끝났을 때. 화면에서 이 id로 상태를 다시 묻는다. */
  pendingPublishId?: string;
  /** 요청한 공개 범위를 못 써서 다른 값으로 올렸을 때 알린다. */
  note?: string;
}

const PRIVACY_LABEL: Record<string, string> = {
  PUBLIC_TO_EVERYONE: '전체 공개',
  FOLLOWER_OF_CREATOR: '팔로워에게만 공개',
  MUTUAL_FOLLOW_FRIENDS: '맞팔로우 친구에게만 공개',
  SELF_ONLY: '나만 보기',
};

function credentials(account: TikTokAccount) {
  // 시크릿은 환경변수를 우선한다. DB(extra)에 들어 있는 건 예전 방식이라
  // 남아 있으면 쓰긴 하지만 새로 저장하지는 않는다.
  const key = process.env.TIKTOK_CLIENT_KEY || account.extra?.client_key;
  const secret = process.env.TIKTOK_CLIENT_SECRET || account.extra?.client_secret;
  return key && secret ? { key, secret } : null;
}

/**
 * 액세스 토큰 갱신. 틱톡 액세스 토큰은 24시간이면 만료되므로 매번 새로 받는다.
 * 갱신하면 refresh token도 새로 내려오니 호출부가 저장해야 한다.
 */
export async function refreshTikTokToken(
  account: TikTokAccount
): Promise<{ accessToken?: string; refreshToken?: string; error?: string }> {
  const cred = credentials(account);
  if (!cred) return { error: '틱톡 앱 설정(client key/secret)이 없습니다.' };
  if (!account.refresh_token) return { error: '틱톡 갱신 토큰이 없습니다. SNS 설정에서 다시 연결해주세요.' };

  const res = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: cred.key,
      client_secret: cred.secret,
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    const raw = [data.error, data.error_description].filter(Boolean).join(' — ');
    if (data.error === 'invalid_grant') {
      return { error: `틱톡 인증이 만료됐습니다. SNS 설정에서 다시 연결해주세요. (${raw})` };
    }
    return { error: `틱톡 토큰 갱신 실패: ${raw || JSON.stringify(data).slice(0, 200)}` };
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token || account.refresh_token || undefined };
}

/** 틱톡이 돌려주는 오류 코드를 한국어로. 모르는 코드는 원문을 남긴다. */
function toKorean(err: { code?: string; message?: string } | undefined): string {
  if (!err) return '알 수 없는 오류';
  const known: Record<string, string> = {
    access_token_invalid: '액세스 토큰이 유효하지 않습니다. SNS 설정에서 다시 연결해주세요.',
    scope_not_authorized: '이 앱에 영상 게시 권한(video.publish)이 없습니다. 틱톡 개발자 포털에서 권한을 확인해주세요.',
    scope_permission_missed: '권한이 부족합니다. SNS 설정에서 다시 연결하며 게시 권한을 허용해주세요.',
    rate_limit_exceeded: '틱톡 요청 한도를 초과했습니다. 잠시 뒤 다시 시도해주세요.',
    spam_risk_too_many_posts: '하루 게시 한도를 초과했습니다.',
    spam_risk_user_banned_from_posting: '이 계정은 현재 게시가 제한된 상태입니다.',
    reached_active_user_cap: '이 앱의 사용자 한도에 도달했습니다.',
    unaudited_client_can_only_post_to_private_accounts:
      '아직 심사를 받지 않은 앱이라 비공개(나만 보기)로만 올릴 수 있습니다.',
    url_ownership_unverified: '영상 주소의 도메인 소유권이 인증되지 않았습니다.',
    privacy_level_option_mismatch: '선택한 공개 범위를 이 계정에서 쓸 수 없습니다.',
    file_format_check_failed: '영상 형식을 틱톡이 읽지 못했습니다. MP4로 다시 만들어주세요.',
    video_pull_failed: '틱톡이 영상을 가져오지 못했습니다.',
  };
  return known[err.code || ''] || `${err.code || ''} ${err.message || ''}`.trim();
}

async function call(path: string, token: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** 게시 상태 조회. 업로드가 끝나도 틱톡 처리에 시간이 걸린다. */
export async function fetchTikTokStatus(
  account: TikTokAccount,
  publishId: string
): Promise<TikTokResult> {
  const { accessToken, error } = await refreshTikTokToken(account);
  if (!accessToken) return { success: false, error: `TikTok: ${error}` };

  const data = await call('/post/publish/status/fetch/', accessToken, { publish_id: publishId });
  if (data.error?.code && data.error.code !== 'ok') {
    return { success: false, error: `TikTok 상태 조회 실패: ${toKorean(data.error)}` };
  }

  const status = data.data?.status;
  if (status === 'PUBLISH_COMPLETE') {
    const postId = data.data?.publicaly_available_post_id?.[0];
    return { success: true, url: postId ? `https://www.tiktok.com/video/${postId}` : 'https://www.tiktok.com/' };
  }
  if (status === 'FAILED') {
    return { success: false, error: `TikTok 게시 실패: ${data.data?.fail_reason || '사유 미상'}` };
  }
  return { success: false, pendingPublishId: publishId, error: `아직 처리 중입니다 (${status}).` };
}

export async function uploadVideoToTikTok(opts: {
  account: TikTokAccount;
  videoUrl: string;
  title: string;
  privacyLevel?: string;
  /** 갱신된 토큰을 저장할 곳. 틱톡은 갱신할 때마다 refresh token을 새로 준다. */
  onTokenRefresh?: (t: { accessToken: string; refreshToken?: string }) => Promise<void>;
}): Promise<TikTokResult> {
  const title = (opts.title || '').trim().slice(0, 2200);
  if (!title) return { success: false, error: 'TikTok: 제목(문구)이 필요합니다.' };

  const { accessToken, refreshToken, error } = await refreshTikTokToken(opts.account);
  if (!accessToken) return { success: false, error: `TikTok: ${error}` };
  if (opts.onTokenRefresh) {
    await opts.onTokenRefresh({ accessToken, refreshToken }).catch(() => {
      /* 저장 실패해도 이번 업로드는 계속한다 */
    });
  }

  // 1) 이 계정에서 쓸 수 있는 공개 범위를 먼저 묻는다.
  //    심사 전 앱은 '나만 보기'만 허용되는데, 임의로 공개를 넣으면 통째로 거부된다.
  const info = await call('/post/publish/creator_info/query/', accessToken, {});
  if (info.error?.code && info.error.code !== 'ok') {
    return { success: false, error: `TikTok 계정 확인 실패: ${toKorean(info.error)}` };
  }
  const options: string[] = info.data?.privacy_level_options || [];
  const wanted = opts.privacyLevel || 'SELF_ONLY';
  // 요청한 값을 못 쓰면 가장 좁은 쪽(나만 보기)으로 떨어뜨린다.
  // 목록의 첫 값을 그냥 쓰면 의도보다 넓게 공개될 수 있다.
  const privacy = options.includes(wanted)
    ? wanted
    : options.includes('SELF_ONLY')
      ? 'SELF_ONLY'
      : options[0];
  if (!privacy) return { success: false, error: 'TikTok: 사용할 수 있는 공개 범위가 없습니다.' };

  const note =
    privacy === wanted
      ? undefined
      : `요청한 공개 범위(${PRIVACY_LABEL[wanted] || wanted})를 이 앱에서 쓸 수 없어 '${PRIVACY_LABEL[privacy] || privacy}'로 올렸습니다. 틱톡 앱에서 직접 바꿀 수 있습니다.`;

  // 2) 영상 내려받기
  let bytes: ArrayBuffer;
  try {
    const videoRes = await fetch(opts.videoUrl);
    if (!videoRes.ok) {
      return { success: false, error: `TikTok: 올려둔 영상을 읽지 못했습니다 (${videoRes.status}).` };
    }
    bytes = await videoRes.arrayBuffer();
  } catch (e: any) {
    return { success: false, error: `TikTok: 영상을 읽는 중 오류 — ${e?.message || e}` };
  }
  const size = bytes.byteLength;
  if (size > MAX_BYTES) {
    return {
      success: false,
      error: `TikTok: 영상이 너무 큽니다 (${Math.round(size / 1024 / 1024)}MB). 200MB 이하로 줄여주세요.`,
    };
  }

  const chunkSize = size <= SINGLE_MAX ? size : CHUNK;
  const chunkCount = size <= SINGLE_MAX ? 1 : Math.floor(size / CHUNK);

  // 3) 업로드 세션 열기
  const init = await call('/post/publish/video/init/', accessToken, {
    post_info: { title, privacy_level: privacy },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: size,
      chunk_size: chunkSize,
      total_chunk_count: chunkCount,
    },
  });
  if (init.error?.code && init.error.code !== 'ok') {
    return { success: false, error: `TikTok 업로드 준비 실패: ${toKorean(init.error)}` };
  }
  const uploadUrl: string = init.data?.upload_url;
  const publishId: string = init.data?.publish_id;
  if (!uploadUrl || !publishId) {
    return { success: false, error: 'TikTok: 업로드 주소를 받지 못했습니다.' };
  }

  // 4) 바이트 전송. 마지막 청크가 나머지를 모두 가져간다(틱톡 규격).
  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const end = i === chunkCount - 1 ? size - 1 : start + chunkSize - 1;
    const part = bytes.slice(start, end + 1);
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(part.byteLength),
        'Content-Range': `bytes ${start}-${end}/${size}`,
      },
      body: part,
    });
    if (!put.ok) {
      const body = await put.text();
      return {
        success: false,
        error: `TikTok 전송 실패 (${i + 1}/${chunkCount}번째 조각): ${put.status} ${body.slice(0, 200)}`,
      };
    }
  }

  // 5) 처리 대기. 라우트 제한이 있으니 오래 기다리지 않고, 안 끝나면 id를 돌려준다.
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const st = await call('/post/publish/status/fetch/', accessToken, { publish_id: publishId });
    const status = st.data?.status;
    if (status === 'PUBLISH_COMPLETE') {
      const postId = st.data?.publicaly_available_post_id?.[0];
      return {
        success: true,
        url: postId ? `https://www.tiktok.com/video/${postId}` : 'https://www.tiktok.com/',
        note,
      };
    }
    if (status === 'FAILED') {
      return { success: false, error: `TikTok 게시 실패: ${st.data?.fail_reason || '사유 미상'}` };
    }
  }

  return {
    success: false,
    pendingPublishId: publishId,
    note,
    error: '영상은 전달됐고 틱톡이 처리 중입니다. 잠시 뒤 상태를 확인해주세요.',
  };
}
