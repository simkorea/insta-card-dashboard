import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const IG_API = 'https://graph.instagram.com/v21.0';

const THREADS_API = 'https://graph.threads.net/v1.0';

// ── Threads ──────────────────────────────────────────────────────────────────

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

async function threadsCreateCarouselItem(userId: string, token: string, imageUrl: string): Promise<string> {
  const params = new URLSearchParams({
    media_type: 'IMAGE',
    image_url: imageUrl,
    is_carousel_item: 'true',
    access_token: token,
  });
  const res = await fetch(`${THREADS_API}/${userId}/threads?${params}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(`캐러셀 아이템 실패: ${JSON.stringify(data)}`);
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

    if (imageUrls.length === 1) {
      containerId = await threadsCreateSingleImage(userId, token, imageUrls[0], caption);
    } else {
      // 캐러셀: 최대 20장, 아이템 컨테이너 병렬 생성
      const urls = imageUrls.slice(0, 20);
      const itemIds = await Promise.all(urls.map(url => threadsCreateCarouselItem(userId, token, url)));

      // 아이템 처리 완료 대기 (충분히 기다려야 container not found 오류 방지)
      await new Promise(r => setTimeout(r, 5000));

      const carouselParams = new URLSearchParams({
        media_type: 'CAROUSEL',
        children: itemIds.join(','),
        text: caption.slice(0, 500),
        access_token: token,
      });
      const carouselRes = await fetch(`${THREADS_API}/${userId}/threads?${carouselParams}`, { method: 'POST' });
      const carousel = await carouselRes.json();
      if (!carouselRes.ok) throw new Error(`캐러셀 컨테이너 실패: ${JSON.stringify(carousel)}`);
      containerId = carousel.id;

      // 캐러셀 컨테이너도 처리 완료 대기 후 publish
      await new Promise(r => setTimeout(r, 3000));
    }

    const mediaId = await threadsPublish(userId, token, containerId);
    const permalink = await threadsGetPermalink(token, mediaId);
    return { success: true, url: permalink };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

const VERCEL_BASE = 'https://insta-card-dashboard.vercel.app';
function toProxyUrl(imageUrl: string): string {
  return `${VERCEL_BASE}/api/img?url=${encodeURIComponent(imageUrl)}`;
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
    const photos = imageUrls.slice(0, 35).map(toProxyUrl);
    // PULL_FROM_URL: TikTok이 외부 URL에서 직접 이미지를 가져오는 방식
    const body = {
      post_info: {
        title: caption.slice(0, 2200) || ' ',
        privacy_level: 'SELF_ONLY',
        brand_content_toggle: false,
        brand_organic_toggle: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_images: photos,
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
    if (data.error?.code === 'access_token_invalid' || data.error?.code === 'token_expired') {
      return { success: false, error: 'TikTok 토큰이 만료되었습니다. TikTok 계정을 재연동해 주세요.' };
    }
    if (data.error?.code === 'permission_denied') {
      return { success: false, error: 'TikTok 앱에 사진 게시 권한이 없습니다. TikTok 개발자 콘솔에서 photo.publish 권한을 추가하세요.' };
    }
    if (data.error?.code === 'url_ownership_unverified') {
      return { success: false, error: 'TikTok URL 소유권 미인증: TikTok 개발자 콘솔(developers.tiktok.com) → 앱 설정 → Content Posting API → URL 소유권 인증에서 "insta-card-dashboard.vercel.app" 도메인을 등록하세요.' };
    }
    return { success: false, error: `TikTok 오류 (${data.error?.code}): ${data.error?.message || JSON.stringify(data)}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Instagram ─────────────────────────────────────────────────────────────────
async function uploadToInstagram(imageUrls: string[], caption: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: settings } = await supabase
      .from('instagram_settings')
      .select('access_token, ig_user_id')
      .limit(1)
      .maybeSingle();

    if (!settings?.access_token || !settings?.ig_user_id) {
      return { success: false, error: 'Instagram 연동 설정이 없습니다. SNS 계정 연동-관리 메뉴에서 먼저 설정하세요.' };
    }

    const { access_token, ig_user_id } = settings;
    const urls = imageUrls.slice(0, 10);
    const authHeader = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

    let containerId: string;

    if (urls.length === 1) {
      // 단일 이미지
      const res = await fetch(`${IG_API}/${ig_user_id}/media`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ image_url: urls[0], caption, media_type: 'IMAGE' }),
      });
      const data = await res.json();
      if (data.error) return { success: false, error: `Instagram: ${data.error.message} (code:${data.error.code})` };
      containerId = data.id;
      await new Promise(r => setTimeout(r, 3000));
    } else {
      // 캐러셀: 하위 컨테이너 병렬 생성
      const childResults = await Promise.all(
        urls.map(url =>
          fetch(`${IG_API}/${ig_user_id}/media`, {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({ image_url: url, is_carousel_item: true }),
          }).then(r => r.json())
        )
      );
      const failed = childResults.find(d => d.error);
      if (failed) return { success: false, error: `Instagram 하위 컨테이너 오류: ${failed.error.message} (code:${failed.error.code})` };

      const childIds = childResults.map(d => d.id).filter(Boolean);

      const carouselRes = await fetch(`${IG_API}/${ig_user_id}/media`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ media_type: 'CAROUSEL', children: childIds.join(','), caption }),
      });
      const carousel = await carouselRes.json();
      if (carousel.error) return { success: false, error: `Instagram 캐러셀 오류: ${carousel.error.message} (code:${carousel.error.code})` };
      containerId = carousel.id;
      await new Promise(r => setTimeout(r, 2000));
    }

    // 상태 확인
    const statusRes = await fetch(`${IG_API}/${containerId}?fields=status_code`, { headers: authHeader });
    const statusData = await statusRes.json();
    if (statusData.status_code && statusData.status_code !== 'FINISHED') {
      return { success: false, error: `Instagram 이미지 처리 중 (${statusData.status_code}). 잠시 후 다시 시도하세요.` };
    }

    // 발행
    const pubRes = await fetch(`${IG_API}/${ig_user_id}/media_publish`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ creation_id: containerId }),
    });
    const pubData = await pubRes.json();
    if (pubData.error) return { success: false, error: `Instagram 발행 실패: ${pubData.error.message} (code:${pubData.error.code})` };

    return { success: true, url: `https://www.instagram.com/p/${pubData.id}/` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
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
