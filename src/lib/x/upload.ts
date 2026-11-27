/**
 * X(Twitter) 게시 — 이미지 카드뉴스(최대 4장)와 세로 영상(쇼츠).
 *
 *  - 미디어는 먼저 /2/media/upload 로 올리고 media_id를 받는다.
 *    이미지는 한 번에(one-shot), 영상은 initialize → append(4MB) → finalize → 상태 폴링.
 *  - 게시는 POST /2/tweets { text, media: { media_ids } }.
 *  - 모든 호출은 user-context OAuth 2.0 Bearer 토큰이 필요하다(tweet.write, media.write).
 *
 * 액세스 토큰은 2시간이면 만료되므로 만료 직전이면 refresh token으로 새로 받고,
 * 받은 새 토큰은 호출한 쪽(onTokenRefresh)이 DB에 저장한다.
 */

import { X_API, refreshXToken, toKoreanXError } from './token';

export type XAccount = {
  access_token: string;
  refresh_token?: string;
  platform_user_id?: string;
  username?: string;
  extra?: Record<string, string>;
};

export type XTokenUpdate = { accessToken: string; refreshToken?: string; expiresAt?: string };

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;   // X 이미지 1장 최대 5MB
const VIDEO_MAX_BYTES = 200 * 1024 * 1024; // 300MB 이하 영상만 다루는 대시보드 규격에 맞춘 안전 상한
const CHUNK_BYTES = 4 * 1024 * 1024;       // append 한 번에 보내는 크기

function toBlobPart(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function xJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text.slice(0, 300) };
  }
}

/** 만료가 임박했으면 토큰을 갱신한다. 갱신 실패 시 기존 토큰으로 시도한다(401이면 안내). */
async function ensureToken(
  account: XAccount,
  onTokenRefresh?: (update: XTokenUpdate) => Promise<void>
): Promise<string> {
  const expiresAt = account.extra?.expires_at ? Date.parse(account.extra.expires_at) : 0;
  const expiringSoon = expiresAt > 0 && expiresAt - Date.now() < 120_000;
  if (!expiringSoon || !account.refresh_token) return account.access_token;

  const refreshed = await refreshXToken(account.refresh_token);
  if (!refreshed.ok) return account.access_token;

  const newExpiresAt = refreshed.expiresIn
    ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
    : undefined;
  try {
    await onTokenRefresh?.({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: newExpiresAt,
    });
  } catch { /* 저장 실패해도 이번 발행은 새 토큰으로 진행한다 */ }
  return refreshed.accessToken;
}

/** 이미지 1장 업로드 → media_id */
async function uploadImage(token: string, imageUrl: string, index: number): Promise<string> {
  const src = await fetch(imageUrl, { cache: 'no-store' });
  if (!src.ok) throw new Error(`이미지 ${index + 1}장을 내려받지 못했습니다 (HTTP ${src.status})`);
  const buf = Buffer.from(await src.arrayBuffer());
  if (buf.byteLength > IMAGE_MAX_BYTES) {
    throw new Error(`이미지 ${index + 1}장이 5MB를 넘습니다 (${(buf.byteLength / 1024 / 1024).toFixed(1)}MB).`);
  }
  const mime = (src.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();

  const form = new FormData();
  form.append('media', new Blob([toBlobPart(buf)], { type: mime }), `slide_${index + 1}.jpg`);
  form.append('media_category', 'tweet_image');
  form.append('media_type', mime.startsWith('image/') ? mime : 'image/jpeg');

  const res = await fetch(`${X_API}/2/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await xJson(res);
  const id = data?.data?.id;
  if (!res.ok || !id) {
    throw new Error(`X 이미지 ${index + 1}장 업로드 실패 — ${toKoreanXError(res.status, data)}`);
  }
  return String(id);
}

/** 영상 업로드 → media_id (처리 완료까지 폴링) */
async function uploadVideo(
  token: string,
  videoUrl: string,
  deadline: number
): Promise<string> {
  const src = await fetch(videoUrl, { cache: 'no-store' });
  if (!src.ok) throw new Error(`영상을 내려받지 못했습니다 (HTTP ${src.status})`);
  const buf = Buffer.from(await src.arrayBuffer());
  if (buf.byteLength > VIDEO_MAX_BYTES) {
    throw new Error(`영상이 ${(VIDEO_MAX_BYTES / 1024 / 1024).toFixed(0)}MB를 넘어 X로 올릴 수 없습니다.`);
  }
  const mime = (src.headers.get('content-type') || 'video/mp4').split(';')[0].trim();

  // 1) 업로드 세션 시작
  const initRes = await fetch(`${X_API}/2/media/upload/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: mime.startsWith('video/') ? mime : 'video/mp4',
      total_bytes: buf.byteLength,
      media_category: 'tweet_video',
    }),
  });
  const init = await xJson(initRes);
  const mediaId = init?.data?.id;
  if (!initRes.ok || !mediaId) {
    throw new Error(`X 영상 업로드 시작 실패 — ${toKoreanXError(initRes.status, init)}`);
  }

  // 2) 4MB씩 전송
  let segment = 0;
  for (let offset = 0; offset < buf.byteLength; offset += CHUNK_BYTES) {
    const chunk = buf.subarray(offset, Math.min(offset + CHUNK_BYTES, buf.byteLength));
    const form = new FormData();
    form.append('media', new Blob([toBlobPart(chunk)], { type: mime }), 'chunk.bin');
    form.append('segment_index', String(segment));
    const res = await fetch(`${X_API}/2/media/upload/${mediaId}/append`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await xJson(res);
    if (!res.ok) {
      throw new Error(`X 영상 ${segment + 1}번째 조각 전송 실패 — ${toKoreanXError(res.status, data)}`);
    }
    segment += 1;
  }

  // 3) 마무리 → 처리 상태
  const finRes = await fetch(`${X_API}/2/media/upload/${mediaId}/finalize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const fin = await xJson(finRes);
  if (!finRes.ok) {
    throw new Error(`X 영상 처리 요청 실패 — ${toKoreanXError(finRes.status, fin)}`);
  }

  let info = fin?.data?.processing_info;
  while (info && info.state !== 'succeeded') {
    if (info.state === 'failed') {
      throw new Error(`X 영상 처리 실패: ${info.error?.message || JSON.stringify(info)}`);
    }
    if (Date.now() > deadline) {
      throw new Error('X에서 영상 변환이 제한 시간 안에 끝나지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
    const waitSec = Math.min(Number(info.check_after_secs) || 3, 10);
    await new Promise(r => setTimeout(r, waitSec * 1000));
    const stRes = await fetch(
      `${X_API}/2/media/upload?command=STATUS&media_id=${encodeURIComponent(mediaId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const st = await xJson(stRes);
    if (!stRes.ok) throw new Error(`X 영상 상태 확인 실패 — ${toKoreanXError(stRes.status, st)}`);
    info = st?.data?.processing_info;
  }

  return String(mediaId);
}

/**
 * 게시.
 * X 무료 계정은 280자(한글은 2로 계산)까지라 긴 카드뉴스 캡션은 잘린다.
 * 프리미엄 계정이면 전문이 그대로 들어가므로, 먼저 전문으로 시도하고
 * 글자 수 초과 오류가 나면 280자 기준으로 줄여 한 번 더 시도한다.
 */
async function createPost(
  token: string,
  text: string,
  mediaIds: string[],
  username?: string
): Promise<{ success: boolean; url?: string; error?: string; note?: string }> {
  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(`${X_API}/2/tweets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await xJson(res);
    return { res, data };
  };

  const fullText = (text || '').trim();
  const base: Record<string, unknown> = mediaIds.length > 0 ? { media: { media_ids: mediaIds } } : {};

  let attempt = await post({ ...base, text: fullText || ' ' });
  let note: string | undefined;

  const tooLong =
    !attempt.res.ok &&
    /too long|character limit|exceeds/i.test(
      JSON.stringify(attempt.data?.detail || attempt.data?.errors || attempt.data || '')
    );
  if (tooLong) {
    const shortened = shortenForX(fullText);
    if (shortened !== fullText) {
      attempt = await post({ ...base, text: shortened });
      note = 'X 글자 수 제한(280자)에 맞춰 캡션을 줄여서 올렸습니다. 전문은 카드뉴스 원본을 봐주세요.';
    }
  }

  const { res, data } = attempt;
  if (!res.ok || !data?.data?.id) {
    return { success: false, error: toKoreanXError(res.status, data) };
  }
  const id = String(data.data.id);
  const url = username ? `https://x.com/${username}/status/${id}` : `https://x.com/i/web/status/${id}`;
  return { success: true, url, note };
}

/** 한글·한자·일본어는 2, 그 외는 1로 계산해 280자에 맞춘다. */
function shortenForX(text: string): string {
  const weight = (ch: string) => (/[\u1100-\u11FF\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]/.test(ch) ? 2 : 1);
  let used = 0;
  let out = '';
  for (const ch of text) {
    const w = weight(ch);
    if (used + w > 279) break;
    used += w;
    out += ch;
  }
  return out.trimEnd() + '…';
}

export async function uploadToX({
  account,
  imageUrls,
  videoUrl,
  caption,
  onTokenRefresh,
}: {
  account: XAccount | null;
  imageUrls?: string[];
  videoUrl?: string;
  caption: string;
  onTokenRefresh?: (update: XTokenUpdate) => Promise<void>;
}): Promise<{ success: boolean; url?: string; error?: string; note?: string }> {
  if (!account?.access_token) {
    return { success: false, error: 'X 계정이 연동되지 않았습니다. SNS 설정에서 먼저 연동하세요.' };
  }

  try {
    const token = await ensureToken(account, onTokenRefresh);
    const mediaIds: string[] = [];
    const notes: string[] = [];

    if (videoUrl) {
      // X는 한 게시물에 영상 1개만 붙는다
      mediaIds.push(await uploadVideo(token, videoUrl, Date.now() + 80_000));
    } else if (imageUrls?.length) {
      const urls = imageUrls.slice(0, 4);
      if (imageUrls.length > 4) {
        notes.push(`X는 한 게시물에 사진 4장까지라 앞 4장만 올렸습니다 (전체 ${imageUrls.length}장).`);
      }
      for (let i = 0; i < urls.length; i++) {
        mediaIds.push(await uploadImage(token, urls[i], i));
      }
    }

    const result = await createPost(token, caption, mediaIds, account.username);
    if (!result.success) return result;
    return {
      success: true,
      url: result.url,
      note: [notes.join(' '), result.note].filter(Boolean).join(' ') || undefined,
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'X 업로드 중 알 수 없는 오류가 발생했습니다.' };
  }
}
