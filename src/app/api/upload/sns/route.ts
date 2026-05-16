import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

const THREADS_API = 'https://graph.threads.net/v1.0';

// ── Threads ──────────────────────────────────────────────────────────────────

async function threadsCreateCarouselItem(userId: string, token: string, imageUrl: string): Promise<string> {
  const params = new URLSearchParams({
    media_type: 'IMAGE',
    image_url: imageUrl,
    is_carousel_item: 'true',
    access_token: token,
  });
  const res = await fetch(`${THREADS_API}/${userId}/threads?${params}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(`carousel item 생성 실패: ${JSON.stringify(data)}`);
  return data.id as string;
}

async function threadsCreateSingleImage(userId: string, token: string, imageUrl: string, caption: string): Promise<string> {
  const params = new URLSearchParams({
    media_type: 'IMAGE',
    image_url: imageUrl,
    text: caption.slice(0, 500),
    access_token: token,
  });
  const res = await fetch(`${THREADS_API}/${userId}/threads?${params}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(`단일 이미지 컨테이너 실패: ${JSON.stringify(data)}`);
  return data.id as string;
}

async function threadsCreateCarouselContainer(userId: string, token: string, children: string[], caption: string): Promise<string> {
  const params = new URLSearchParams({
    media_type: 'CAROUSEL',
    children: children.join(','),
    text: caption.slice(0, 500),
    access_token: token,
  });
  const res = await fetch(`${THREADS_API}/${userId}/threads?${params}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(`캐러셀 컨테이너 실패: ${JSON.stringify(data)}`);
  return data.id as string;
}

async function threadsPublish(userId: string, token: string, containerId: string): Promise<string> {
  const params = new URLSearchParams({ creation_id: containerId, access_token: token });
  const res = await fetch(`${THREADS_API}/${userId}/threads_publish?${params}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(`게시 실패: ${JSON.stringify(data)}`);
  return data.id as string;
}

async function threadsGetPermalink(token: string, mediaId: string): Promise<string> {
  const params = new URLSearchParams({ fields: 'id,permalink', access_token: token });
  const res = await fetch(`${THREADS_API}/${mediaId}?${params}`);
  if (!res.ok) return 'https://www.threads.net/';
  const data = await res.json();
  return (data.permalink as string) || 'https://www.threads.net/';
}

async function uploadToThreads(imageUrls: string[], caption: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const token = process.env.THREADS_ACCESS_TOKEN;
  const userId = process.env.THREADS_USER_ID;
  if (!token || !userId) return { success: false, error: 'THREADS_ACCESS_TOKEN 또는 THREADS_USER_ID 환경변수 없음' };

  try {
    let containerId: string;

    // Hobby 플랜 10초 제한 — 캐러셀은 대기 시간이 길어 단일 이미지(첫 장)만 업로드
    containerId = await threadsCreateSingleImage(userId, token, imageUrls[0], caption);

    const mediaId = await threadsPublish(userId, token, containerId);
    const permalink = await threadsGetPermalink(token, mediaId);
    return { success: true, url: permalink };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── TikTok ───────────────────────────────────────────────────────────────────

async function tiktokRefreshToken(): Promise<string | null> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const refreshToken = process.env.TIKTOK_REFRESH_TOKEN;
  if (!clientKey || !clientSecret || !refreshToken) return null;

  const params = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  return data.access_token || null;
}

async function uploadToTikTok(imageUrls: string[], caption: string): Promise<{ success: boolean; url?: string; error?: string }> {
  let accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) return { success: false, error: 'TIKTOK_ACCESS_TOKEN 환경변수 없음' };

  // 토큰 갱신 시도
  const refreshed = await tiktokRefreshToken();
  if (refreshed) accessToken = refreshed;

  try {
    const body = {
      post_info: {
        title: caption.slice(0, 150),
        privacy_level: 'SELF_ONLY',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'URL_UPLOAD',
        photo_images: imageUrls.slice(0, 35),
        photo_cover_index: 0,
      },
      media_type: 'PHOTO',
      post_mode: 'DIRECT_POST',
    };

    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.error?.code === 'ok' || data.data?.publish_id) {
      return { success: true, url: 'https://www.tiktok.com/' };
    }
    return { success: false, error: `TikTok 오류: ${data.error?.message || JSON.stringify(data)}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Instagram ─────────────────────────────────────────────────────────────────
// instagrapi(Python)를 서버에서 직접 호출할 수 없으므로,
// Meta Graph API 방식이 필요합니다. (별도 Instagram Business 토큰 필요)
async function uploadToInstagram(_imageUrls: string[], _caption: string): Promise<{ success: boolean; url?: string; error?: string }> {
  return {
    success: false,
    error: 'Instagram은 Meta Graph API Business 토큰이 별도로 필요합니다. (현재 미지원)',
  };
}

// ── YouTube ───────────────────────────────────────────────────────────────────
// YouTube는 이미지 게시물을 지원하지 않습니다 (동영상 전용)
async function uploadToYouTube(_imageUrls: string[], _caption: string): Promise<{ success: boolean; url?: string; error?: string }> {
  return {
    success: false,
    error: 'YouTube는 이미지 게시물을 지원하지 않습니다. 동영상(릴스/Shorts) 전용입니다.',
  };
}

// ── X (Twitter) ───────────────────────────────────────────────────────────────
async function uploadToX(_imageUrls: string[], _caption: string): Promise<{ success: boolean; url?: string; error?: string }> {
  return {
    success: false,
    error: 'X(Twitter) API 키가 설정되지 않았습니다.',
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { imageUrls, caption, platforms } = await req.json() as {
      imageUrls: string[];
      caption: string;
      platforms: string[];
    };

    if (!imageUrls?.length) return NextResponse.json({ error: '이미지 URL이 없습니다' }, { status: 400 });

    const results: Record<string, { success: boolean; url?: string; error?: string }> = {};

    await Promise.all(
      platforms.map(async (platform) => {
        switch (platform) {
          case 'threads':
            results.threads = await uploadToThreads(imageUrls, caption);
            break;
          case 'instagram':
            results.instagram = await uploadToInstagram(imageUrls, caption);
            break;
          case 'tiktok':
            results.tiktok = await uploadToTikTok(imageUrls, caption);
            break;
          case 'youtube':
            results.youtube = await uploadToYouTube(imageUrls, caption);
            break;
          case 'x':
            results.x = await uploadToX(imageUrls, caption);
            break;
        }
      })
    );

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
