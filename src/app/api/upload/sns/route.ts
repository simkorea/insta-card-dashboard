import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { uploadShortToYoutube } from '@/lib/youtube/upload';
import { uploadVideoToTikTok, fetchTikTokStatus } from '@/lib/tiktok/upload';
import { createClient } from '@supabase/supabase-js';

/** 틱톡 토큰 저장용. RLS를 우회해야 하는 쓰기라 service role로 만든다. */
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** 유튜브식 공개범위 → 틱톡식. 없는 개념(일부공개)은 가장 좁은 쪽으로 보낸다. */
function toTikTokPrivacy(p?: string): string {
  if (p === 'public') return 'PUBLIC_TO_EVERYONE';
  return 'SELF_ONLY';
}

export const maxDuration = 120; // 캐러셀 10장은 컨테이너 처리 대기가 길어질 수 있다

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
  const headers = { 'Content-Type': 'application/json' };

  // Meta는 imgur 등 일부 도메인을 차단 → 프록시 URL 사용
  const proxiedUrls = imageUrls.map(toProxyUrl);

  try {
    let containerId: string;
    const urls = proxiedUrls.slice(0, 10);

    if (urls.length === 1) {
      const payload = {
        media_type: 'IMAGE',
        image_url: urls[0],
        text: caption.slice(0, 500),
        access_token: token,
      };
      const res = await fetch(`${THREADS_API}/${userId}/threads`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch (e) {}
      if (!res.ok) {
        console.error(`[Threads/단일생성 오류로그] URL: ${urls[0]}, 상태: ${res.status}, 응답: ${text}`);
        throw new Error(`[Threads/단일이미지생성] 에러(${res.status}) [이미지: ${urls[0]}]: ${text || '빈 응답'}`);
      }
      if (data.error) throw new Error(`[Threads/단일이미지생성] 실패 [이미지: ${urls[0]}]: ${JSON.stringify(data.error)}`);
      
      containerId = data.id;
      await new Promise(r => setTimeout(r, 3000));
    } else {
      const itemIds = await Promise.all(urls.map(async (url) => {
        const payload = {
          media_type: 'IMAGE',
          image_url: url,
          is_carousel_item: true,
          access_token: token,
        };
        const res = await fetch(`${THREADS_API}/${userId}/threads`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        const text = await res.text();
        let data: any = {};
        try { data = text ? JSON.parse(text) : {}; } catch (e) {}
        
        if (!res.ok) {
          const maskedPayload = { ...payload, access_token: '***' };
          console.error(`[Threads/아이템생성 오류로그] URL: ${url}`);
          console.error(`요청 파라미터: ${JSON.stringify(maskedPayload)}`);
          console.error(`응답 상태: ${res.status}, 본문: ${text}`);
          
          throw new Error(`[Threads/아이템생성] 에러(${res.status}) [이미지: ${url}]: ${text || '빈 응답'}`);
        }
        if (data.error) throw new Error(`[Threads/아이템생성] 실패 [이미지: ${url}]: ${JSON.stringify(data.error)}`);
        return data.id as string;
      }));

      await new Promise(r => setTimeout(r, 5000));

      const carouselRes = await fetch(`${THREADS_API}/${userId}/threads`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          children: itemIds.join(','),
          text: caption.slice(0, 500),
          access_token: token,
        })
      });
      const text = await carouselRes.text();
      let carousel: any = {};
      try { carousel = text ? JSON.parse(text) : {}; } catch (e) {}
      if (!carouselRes.ok) throw new Error(`[Threads/캐러셀생성] 에러(${carouselRes.status}): ${text || '빈 응답'}`);
      if (carousel.error) throw new Error(`[Threads/캐러셀생성] 실패: ${JSON.stringify(carousel.error)}`);
      containerId = carousel.id;

      await new Promise(r => setTimeout(r, 3000));
    }

    let isReady = false;
    for (let i = 0; i < 5; i++) {
      const statusRes = await fetch(`${THREADS_API}/${containerId}?fields=status&access_token=${token}`, { headers });
      const text = await statusRes.text();
      let statusData: any = {};
      try { statusData = text ? JSON.parse(text) : {}; } catch (e) {}
      if (!statusRes.ok) throw new Error(`[Threads/폴링] 에러(${statusRes.status}): ${text || '빈 응답'}`);
      if (statusData.error) throw new Error(`[Threads/폴링] 실패: ${JSON.stringify(statusData.error)}`);
      
      if (statusData.status === 'FINISHED') {
        isReady = true;
        break;
      }
      if (statusData.status === 'ERROR') {
        throw new Error(`[Threads/폴링] 컨테이너 상태 에러: ${JSON.stringify(statusData)}`);
      }
      await new Promise(r => setTimeout(r, 3000));
    }

    if (!isReady) {
      throw new Error(`Threads 이미지 처리 지연. 잠시 후 다시 시도해주세요.`);
    }

    const pubRes = await fetch(`${THREADS_API}/${userId}/threads_publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        creation_id: containerId,
        access_token: token,
      })
    });
    const pubText = await pubRes.text();
    let pubData: any = {};
    try { pubData = pubText ? JSON.parse(pubText) : {}; } catch (e) {}
    if (!pubRes.ok) throw new Error(`[Threads/발행] 에러(${pubRes.status}): ${pubText || '빈 응답'}`);
    if (pubData.error) throw new Error(`[Threads/발행] 실패: ${JSON.stringify(pubData.error)}`);

    const permalinkRes = await fetch(`${THREADS_API}/${pubData.id}?fields=id,permalink&access_token=${token}`, { headers });
    const permalinkText = await permalinkRes.text();
    let permalinkData: any = {};
    try { permalinkData = permalinkText ? JSON.parse(permalinkText) : {}; } catch (e) {}
    if (!permalinkRes.ok) throw new Error(`[Threads/퍼머링크조회] 에러(${permalinkRes.status}): ${permalinkText || '빈 응답'}`);
    
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
    // Creator info 조회로 허용된 privacy_level 확인
    let privacyLevel = 'SELF_ONLY';
    try {
      const creatorRes = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({}),
      });
      const creatorData = await creatorRes.json();
      const options: string[] = creatorData.data?.privacy_level_options ?? [];
      if (options.length > 0) {
        privacyLevel = options.includes('SELF_ONLY') ? 'SELF_ONLY' : options[0];
      }
    } catch { /* fallback */ }

    const photos = imageUrls.slice(0, 35).map(toProxyUrl);
    const title = (caption || '').slice(0, 2200).trim() || '카드뉴스';
    const body = {
      post_info: {
        title,
        privacy_level: privacyLevel,
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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Meta는 멀쩡한 요청에도 가끔 일시적 오류("Fatal" 등)를 돌려준다.
 * 실제로 10장짜리 캐러셀 업로드가 하위 컨테이너 단계에서 "Fatal"로 실패했는데,
 * 곧바로 같은 이미지·같은 토큰으로 다시 시도하니 10장 모두 성공했다.
 * 한 장이라도 실패하면 업로드 전체가 날아가므로 장별로 재시도한다.
 */
const TRANSIENT = /fatal|unknown error|temporarily|try again|internal|timeout/i;

async function createContainerWithRetry(
  igUserId: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  attempts = 3
): Promise<{ id?: string; error?: string }> {
  let last = '알 수 없는 오류';
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${IG_API}/${igUserId}/media`, {
        method: 'POST',
        headers,
        // media_type 명시 필수 — 미설정 시 "Only photo or video" 오류 발생
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.id) return { id: data.id };
      last = data.error?.message || '컨테이너 ID를 받지 못했습니다';
      // 이미지가 잘못됐거나 권한이 없는 건 다시 해도 같으므로 즉시 포기한다
      if (!TRANSIENT.test(last)) return { error: last };
    } catch (e: any) {
      last = e?.message || '네트워크 오류';
    }
    if (i < attempts - 1) await sleep(1500 * (i + 1));
  }
  return { error: last };
}

/**
 * 컨테이너가 처리될 때까지 기다린다.
 * 예전에는 고정 2초 뒤 한 번만 확인해서, 10장짜리처럼 오래 걸리는 건
 * 멀쩡한데도 "이미지 처리 중입니다. 잠시 후 다시 시도하세요"로 실패 처리됐다.
 */
async function waitForContainer(
  containerId: string,
  headers: Record<string, string>,
  deadline: number
): Promise<{ ok: boolean; error?: string }> {
  let last = '';
  while (Date.now() < deadline) {
    const res = await fetch(`${IG_API}/${containerId}?fields=status_code,status`, { headers });
    const data = await res.json();
    const code = data.status_code;
    if (code === 'FINISHED') return { ok: true };
    if (code === 'ERROR' || code === 'EXPIRED') {
      return { ok: false, error: `이미지 처리 실패 (${code}${data.status ? `: ${data.status}` : ''})` };
    }
    last = code || '';
    await sleep(2500);
  }
  return { ok: false, error: `이미지 처리가 제한 시간 안에 끝나지 않았습니다 (마지막 상태: ${last || '알 수 없음'})` };
}

/**
 * 릴스(영상) 발행.
 *
 * 이미지와 결정적으로 다른 점: Meta가 영상을 트랜스코딩하는 데 수십 초~수 분이
 * 걸린다. 라우트 제한(maxDuration) 안에 못 끝나는 경우가 정상적으로 발생하므로,
 * 실패로 처리하지 않고 컨테이너 id를 돌려줘서 나중에 발행을 마무리할 수 있게 한다.
 * (컨테이너는 24시간 유효하다)
 */
async function uploadReelToInstagram(
  account: { access_token: string; platform_user_id: string } | null,
  videoUrl: string,
  caption: string,
  coverUrl?: string
): Promise<{ success: boolean; url?: string; error?: string; pendingContainerId?: string }> {
  if (!account?.access_token || !account?.platform_user_id) {
    return { success: false, error: 'Instagram 계정이 연동되지 않았습니다. SNS 설정에서 먼저 연동하세요.' };
  }
  const { access_token, platform_user_id: ig_user_id } = account;
  const authHeader = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

  try {
    const body: Record<string, unknown> = {
      media_type: 'REELS',
      video_url: toProxyUrl(videoUrl),
      caption,
    };
    if (coverUrl) body.cover_url = toProxyUrl(coverUrl);

    const created = await createContainerWithRetry(ig_user_id, authHeader, body);
    if (!created.id) return { success: false, error: `Instagram 릴스: ${created.error}` };

    // 영상은 오래 걸린다 — 남은 예산만큼만 기다리고, 못 끝나면 이어서 할 수 있게 넘긴다
    const st = await waitForContainer(created.id, authHeader, Date.now() + 80000);
    if (!st.ok) {
      if (/제한 시간/.test(st.error || '')) {
        return {
          success: false,
          pendingContainerId: created.id,
          error: '영상 변환이 아직 진행 중입니다. 잠시 후 "발행 마무리"를 눌러주세요.',
        };
      }
      return { success: false, error: `Instagram 릴스 ${st.error}` };
    }

    return await publishContainer(ig_user_id, authHeader, created.id);
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** 준비된 컨테이너를 실제로 발행한다 (이미지·릴스 공통) */
async function publishContainer(
  igUserId: string,
  headers: Record<string, string>,
  containerId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const res = await fetch(`${IG_API}/${igUserId}/media_publish`, {
    method: 'POST', headers,
    body: JSON.stringify({ creation_id: containerId }),
  });
  const data = await res.json();
  if (data.error) return { success: false, error: `Instagram 발행 실패: ${data.error.message}` };
  // permalink를 따로 조회한다. 발행 id를 그대로 URL에 넣으면 열리지 않는다.
  try {
    const info = await (await fetch(`${IG_API}/${data.id}?fields=permalink`, { headers })).json();
    if (info.permalink) return { success: true, url: info.permalink };
  } catch { /* permalink 조회 실패는 발행 성공에 영향 없음 */ }
  return { success: true, url: 'https://www.instagram.com/' };
}

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
      // 단일 이미지는 캡션을 컨테이너에 같이 넣는다
      const single = await createContainerWithRetry(ig_user_id, authHeader, {
        image_url: urls[0], caption, media_type: 'IMAGE',
      });
      if (!single.id) return { success: false, error: `Instagram: ${single.error}` };
      containerId = single.id;
    } else {
      const childResults = await Promise.all(
        urls.map(url =>
          createContainerWithRetry(ig_user_id, authHeader, {
            image_url: url, is_carousel_item: true, media_type: 'IMAGE',
          })
        )
      );
      const failed = childResults.filter(d => !d.id);
      if (failed.length > 0) {
        return {
          success: false,
          error: `Instagram: ${urls.length}장 중 ${failed.length}장을 올리지 못했습니다 — ${failed[0].error}`,
        };
      }

      // 자식들이 다 처리돼야 캐러셀이 만들어진다. 예전에는 확인하지 않고
      // 바로 캐러셀을 만들어서 간헐적으로 실패했다.
      // 라우트 제한(maxDuration)이 있으므로 하나씩이 아니라 함께 기다리고,
      // 전체 대기 예산을 공유한다.
      const childStates = await Promise.all(
        childResults.map(c => waitForContainer(c.id!, authHeader, Date.now() + 35000))
      );
      const stuck = childStates.find(s => !s.ok);
      if (stuck) return { success: false, error: `Instagram ${stuck.error}` };

      const childIds = childResults.map(d => d.id!);
      const carouselRes = await fetch(`${IG_API}/${ig_user_id}/media`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({ media_type: 'CAROUSEL', children: childIds.join(','), caption }),
      });
      const carousel = await carouselRes.json();
      if (carousel.error) return { success: false, error: `Instagram 캐러셀 오류: ${carousel.error.message}` };
      containerId = carousel.id;
    }

    // 캐러셀 컨테이너도 처리될 때까지 기다린다 (남은 예산 안에서)
    const st = await waitForContainer(containerId, authHeader, Date.now() + 20000);
    if (!st.ok) return { success: false, error: `Instagram ${st.error}` };

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

    const {
      imageUrls, videoUrl, coverUrl, finishContainerId, caption, platforms,
      title, privacyStatus, checkPublishId,
    } = await req.json() as {
      imageUrls?: string[];
      videoUrl?: string;        // 릴스: 올려둔 MP4 공개 주소
      coverUrl?: string;        // 릴스 표지(선택)
      finishContainerId?: string; // 변환이 늦어 미뤄둔 컨테이너를 마저 발행할 때
      caption: string;
      platforms: string[];
      title?: string;           // 유튜브 제목 (인스타에는 제목 개념이 없다)
      privacyStatus?: 'public' | 'unlisted' | 'private';
      checkPublishId?: string;  // 틱톡: 처리 중이던 게시의 상태를 다시 물을 때
    };

    const isVideo = Boolean(videoUrl || finishContainerId || checkPublishId);
    if (!isVideo && !imageUrls?.length) {
      return NextResponse.json({ error: '이미지 URL이 없습니다' }, { status: 400 });
    }

    // 현재 로그인한 사용자의 SNS 계정 토큰 조회
    const { data: snsRows } = await supabase
      .from('sns_accounts')
      .select('platform, access_token, refresh_token, platform_user_id, username, extra')
      .eq('user_id', user.id);

    const accounts: Record<string, any> = {};
    for (const row of snsRows || []) {
      accounts[row.platform] = row;
    }

    const results: Record<
      string,
      {
        success: boolean;
        url?: string;
        error?: string;
        pendingContainerId?: string;
        pendingPublishId?: string;
        note?: string;
      }
    > = {};

    await Promise.all(
      platforms.map(async (platform) => {
        switch (platform) {
          case 'threads':
            results.threads = isVideo
              ? { success: false, error: 'Threads 영상 업로드는 아직 지원하지 않습니다.' }
              : await uploadToThreads(accounts.threads ?? null, imageUrls!, caption);
            break;
          case 'instagram':
            if (finishContainerId) {
              // 앞서 변환이 안 끝나 미뤄둔 릴스를 마저 발행한다
              const acc = accounts.instagram;
              results.instagram = acc
                ? await publishContainer(
                    acc.platform_user_id,
                    { Authorization: `Bearer ${acc.access_token}`, 'Content-Type': 'application/json' },
                    finishContainerId
                  )
                : { success: false, error: 'Instagram 계정이 연동되지 않았습니다.' };
            } else if (videoUrl) {
              results.instagram = await uploadReelToInstagram(accounts.instagram ?? null, videoUrl, caption, coverUrl);
            } else {
              results.instagram = await uploadToInstagram(accounts.instagram ?? null, imageUrls!, caption);
            }
            break;
          case 'tiktok': {
            const acc = accounts.tiktok;
            if (!videoUrl && !checkPublishId) {
              results.tiktok = { success: false, error: 'TikTok은 이미지 게시물을 지원하지 않습니다. 영상 전용입니다.' };
            } else if (!acc?.refresh_token) {
              results.tiktok = { success: false, error: 'TikTok 계정이 연동되지 않았습니다. SNS 설정에서 연결해주세요.' };
            } else if (checkPublishId) {
              results.tiktok = await fetchTikTokStatus(acc, checkPublishId);
            } else {
              results.tiktok = await uploadVideoToTikTok({
                account: acc,
                videoUrl: videoUrl!,
                title: (caption || title || '').trim(),
                privacyLevel: toTikTokPrivacy(privacyStatus),
                // 틱톡은 갱신할 때마다 refresh token을 새로 준다. 저장 안 하면
                // 다음에 못 쓸 수 있다.
                onTokenRefresh: async ({ accessToken, refreshToken }) => {
                  const svc = serviceClient();
                  if (!svc) return;
                  await svc
                    .from('sns_accounts')
                    .update({ access_token: accessToken, refresh_token: refreshToken })
                    .eq('user_id', user.id)
                    .eq('platform', 'tiktok');
                },
              });
            }
            break;
          }
          case 'youtube':
            if (!videoUrl) {
              results.youtube = { success: false, error: 'YouTube는 이미지 게시물을 지원하지 않습니다. 동영상 전용입니다.' };
            } else if (!accounts.youtube?.refresh_token) {
              results.youtube = { success: false, error: 'YouTube 계정이 연동되지 않았습니다. SNS 설정에서 연결해주세요.' };
            } else {
              results.youtube = await uploadShortToYoutube({
                refreshToken: accounts.youtube.refresh_token,
                videoUrl,
                title: (title || caption || '').trim(),
                description: caption,
                privacyStatus,
              });
            }
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
