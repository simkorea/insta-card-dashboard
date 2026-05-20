import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const maxDuration = 60;

const IG_API = 'https://graph.instagram.com/v21.0';
const THREADS_API = 'https://graph.threads.net/v1.0';
const VERCEL_BASE = 'https://insta-card-dashboard.vercel.app';

function toProxyUrl(imageUrl: string): string {
  return `${VERCEL_BASE}/api/img?url=${encodeURIComponent(imageUrl)}`;
}

// ── Threads ──────────────────────────────────────────────────────────────────

async function uploadToThreads(
  account: { access_token: string; platform_user_id: string } | null,
  imageUrls: string[],
  caption: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!account?.access_token || !account?.platform_user_id) {
    return { success: false, error: 'Threads 계정이 연동되지 않았습니다. SNS 설정에서 먼저 연동하세요.' };
  }
  const { access_token: token, platform_user_id: userId } = account;

  // Meta는 imgur 등 일부 도메인을 차단 → 프록시 URL 사용
  const proxiedUrls = imageUrls.map(toProxyUrl);

  try {
    let containerId: string;

    if (proxiedUrls.length === 1) {
      const params = new URLSearchParams({
        media_type: 'IMAGE', image_url: proxiedUrls[0],
        text: caption.slice(0, 500), access_token: token,
      });
      const res = await fetch(`${THREADS_API}/${userId}/threads?${params}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(`단일 이미지 컨테이너 실패: ${JSON.stringify(data)}`);
      containerId = data.id;
    } else {
      const urls = proxiedUrls.slice(0, 20);
      const itemIds = await Promise.all(urls.map(async (url) => {
        const params = new URLSearchParams({
          media_type: 'IMAGE', image_url: url,
          is_carousel_item: 'true', access_token: token,
        });
        const res = await fetch(`${THREADS_API}/${userId}/threads?${params}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(`캐러셀 아이템 실패: ${JSON.stringify(data)}`);
        return data.id as string;
      }));

      await new Promise(r => setTimeout(r, 5000));

      const carouselParams = new URLSearchParams({
        media_type: 'CAROUSEL', children: itemIds.join(','),
        text: caption.slice(0, 500), access_token: token,
      });
      const carouselRes = await fetch(`${THREADS_API}/${userId}/threads?${carouselParams}`, { method: 'POST' });
      const carousel = await carouselRes.json();
      if (!carouselRes.ok) throw new Error(`캐러셀 컨테이너 실패: ${JSON.stringify(carousel)}`);
      containerId = carousel.id;

      await new Promise(r => setTimeout(r, 3000));
    }

    const pubParams = new URLSearchParams({ creation_id: containerId, access_token: token });
    const pubRes = await fetch(`${THREADS_API}/${userId}/threads_publish?${pubParams}`, { method: 'POST' });
    const pubData = await pubRes.json();
    if (!pubRes.ok) throw new Error(`게시 실패: ${JSON.stringify(pubData)}`);

    const permalinkRes = await fetch(`${THREADS_API}/${pubData.id}?fields=id,permalink&access_token=${token}`);
    const permalinkData = await permalinkRes.json();
    return { success: true, url: permalinkData.permalink || 'https://www.threads.net/' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── TikTok ───────────────────────────────────────────────────────────────────

async function uploadToTikTok(
  account: { access_token: string; refresh_token?: string; extra?: Record<string, string> } | null,
  imageUrls: string[],
  caption: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!account?.access_token) {
    return { success: false, error: 'TikTok 계정이 연동되지 않았습니다. SNS 설정에서 먼저 연동하세요.' };
  }

  let accessToken = account.access_token;

  // 토큰 갱신 시도
  const extra = account.extra || {};
  if (account.refresh_token && extra.client_key && extra.client_secret) {
    try {
      const params = new URLSearchParams({
        client_key: extra.client_key,
        client_secret: extra.client_secret,
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token,
      });
      const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      const data = await res.json();
      if (data.access_token) accessToken = data.access_token;
    } catch { /* 갱신 실패 시 기존 토큰 사용 */ }
  }

  try {
    const photos = imageUrls.slice(0, 35).map(toProxyUrl);
    const title = (caption || '').slice(0, 2200).trim() || '카드뉴스';
    const body = {
      post_info: {
        title,
        privacy_level: 'SELF_ONLY',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
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
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.error?.code === 'ok' || data.data?.publish_id) {
      return { success: true, url: 'https://www.tiktok.com/' };
    }
    if (data.error?.code === 'access_token_invalid' || data.error?.code === 'token_expired') {
      return { success: false, error: 'TikTok 토큰이 만료되었습니다. SNS 설정에서 TikTok 계정을 재연동하세요.' };
    }
    if (data.error?.code === 'url_ownership_unverified') {
      return { success: false, error: 'TikTok URL 소유권 미인증: TikTok 개발자 콘솔에서 도메인을 등록하세요.' };
    }
    return { success: false, error: `TikTok 오류 (${data.error?.code}): ${data.error?.message || JSON.stringify(data)}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Instagram ─────────────────────────────────────────────────────────────────

async function uploadToInstagram(
  account: { access_token: string; platform_user_id: string } | null,
  imageUrls: string[],
  caption: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!account?.access_token || !account?.platform_user_id) {
    return { success: false, error: 'Instagram 계정이 연동되지 않았습니다. SNS 설정에서 먼저 연동하세요.' };
  }

  const { access_token, platform_user_id: ig_user_id } = account;
  const authHeader = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };
  // Meta는 일부 이미지 도메인을 거부 → 프록시 URL 사용
  const urls = imageUrls.slice(0, 10).map(toProxyUrl);

  try {
    let containerId: string;

    if (urls.length === 1) {
      const res = await fetch(`${IG_API}/${ig_user_id}/media`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({ image_url: urls[0], caption, media_type: 'IMAGE' }),
      });
      const data = await res.json();
      if (data.error) return { success: false, error: `Instagram: ${data.error.message} (code:${data.error.code})` };
      containerId = data.id;
      await new Promise(r => setTimeout(r, 3000));
    } else {
      const childResults = await Promise.all(
        urls.map(url =>
          fetch(`${IG_API}/${ig_user_id}/media`, {
            method: 'POST', headers: authHeader,
            // media_type 명시 필수 — 미설정 시 "Only photo or video" 오류 발생
            body: JSON.stringify({ image_url: url, is_carousel_item: true, media_type: 'IMAGE' }),
          }).then(r => r.json())
        )
      );
      const failed = childResults.find(d => d.error);
      if (failed) return { success: false, error: `Instagram 하위 컨테이너 오류: ${failed.error.message}` };

      const childIds = childResults.map(d => d.id).filter(Boolean);
      const carouselRes = await fetch(`${IG_API}/${ig_user_id}/media`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({ media_type: 'CAROUSEL', children: childIds.join(','), caption }),
      });
      const carousel = await carouselRes.json();
      if (carousel.error) return { success: false, error: `Instagram 캐러셀 오류: ${carousel.error.message}` };
      containerId = carousel.id;
      await new Promise(r => setTimeout(r, 2000));
    }

    const statusRes = await fetch(`${IG_API}/${containerId}?fields=status_code`, { headers: authHeader });
    const statusData = await statusRes.json();
    if (statusData.status_code && statusData.status_code !== 'FINISHED') {
      return { success: false, error: `Instagram 이미지 처리 중 (${statusData.status_code}). 잠시 후 다시 시도하세요.` };
    }

    const pubRes = await fetch(`${IG_API}/${ig_user_id}/media_publish`, {
      method: 'POST', headers: authHeader,
      body: JSON.stringify({ creation_id: containerId }),
    });
    const pubData = await pubRes.json();
    if (pubData.error) return { success: false, error: `Instagram 발행 실패: ${pubData.error.message}` };
    return { success: true, url: `https://www.instagram.com/p/${pubData.id}/` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 로그인 확인
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { imageUrls, caption, platforms } = await req.json() as {
      imageUrls: string[];
      caption: string;
      platforms: string[];
    };

    if (!imageUrls?.length) return NextResponse.json({ error: '이미지 URL이 없습니다' }, { status: 400 });

    // 현재 로그인한 사용자의 SNS 계정 토큰 조회
    const { data: snsRows } = await supabase
      .from('sns_accounts')
      .select('platform, access_token, refresh_token, platform_user_id, username, extra')
      .eq('user_id', user.id);

    const accounts: Record<string, any> = {};
    for (const row of snsRows || []) {
      accounts[row.platform] = row;
    }

    const results: Record<string, { success: boolean; url?: string; error?: string }> = {};

    await Promise.all(
      platforms.map(async (platform) => {
        switch (platform) {
          case 'threads':
            results.threads = await uploadToThreads(accounts.threads ?? null, imageUrls, caption);
            break;
          case 'instagram':
            results.instagram = await uploadToInstagram(accounts.instagram ?? null, imageUrls, caption);
            break;
          case 'tiktok':
            results.tiktok = await uploadToTikTok(accounts.tiktok ?? null, imageUrls, caption);
            break;
          case 'youtube':
            results.youtube = { success: false, error: 'YouTube는 이미지 게시물을 지원하지 않습니다. 동영상 전용입니다.' };
            break;
          case 'x':
            results.x = { success: false, error: 'X(Twitter) 연동은 준비 중입니다.' };
            break;
        }
      })
    );

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
