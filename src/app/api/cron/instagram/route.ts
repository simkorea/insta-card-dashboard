import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const IG_API = 'https://graph.instagram.com/v21.0';

async function waitForContainerReady(
  containerId: string,
  access_token: string,
  timeoutSec = 90,
): Promise<boolean> {
  const startTime = Date.now();
  const maxWaitMs = timeoutSec * 1000;
  let attempt = 0;

  console.log(`[Cron:Instagram] 컨테이너 ${containerId} 준비 상태 대기 시작 (최대 ${timeoutSec}초)...`);

  while (Date.now() - startTime < maxWaitMs) {
    attempt++;
    const res = await fetch(
      `${IG_API}/${containerId}?fields=status_code,status&access_token=${access_token}`
    );
    const data = await res.json();

    const statusCode: string = data.status_code || 'UNKNOWN';
    console.log(
      `[Cron:Instagram] 컨테이너 ${containerId} 상태 확인 (#${attempt}, status_code: ${statusCode})`
    );

    if (statusCode === 'FINISHED') {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Cron:Instagram] 컨테이너 ${containerId} 준비 완료 (FINISHED, 소요시간: ${elapsedSec}s)`);
      return true;
    }

    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      const errMsg = data.status || data.error?.message || `컨테이너 처리 실패 (${statusCode})`;
      console.error(`[Cron:Instagram] 컨테이너 ${containerId} 오류 발생: status_code=${statusCode} - ${errMsg}`);
      throw new Error(`컨테이너 처리 실패 (status_code: ${statusCode}): ${errMsg}`);
    }

    // IN_PROGRESS 또는 기타 상태: 3초 후 재시도
    await new Promise(r => setTimeout(r, 3000));
  }

  console.error(`[Cron:Instagram] 컨테이너 ${containerId} 준비 대기 타임아웃 (${timeoutSec}초 초과)`);
  throw new Error(`컨테이너 준비 대기 타임아웃 (${timeoutSec}초 초과)`);
}

async function createChildContainer(ig_user_id: string, access_token: string, imageUrl: string) {
  const res = await fetch(`${IG_API}/${ig_user_id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, is_carousel_item: true, access_token }),
  });
  const data = await res.json();
  if (!data.id) {
    console.error(`[Cron:Instagram] 하위 컨테이너 생성 실패 (Image: ${imageUrl.slice(0, 80)}...) - 에러: ${data.error?.message || JSON.stringify(data.error)}`);
    throw new Error(data.error?.message || '하위 컨테이너 생성 실패');
  }
  console.log(`[Cron:Instagram] 하위 컨테이너 생성 성공 - Container ID: ${data.id}`);
  return data.id as string;
}

async function publishToInstagram(
  ig_user_id: string,
  access_token: string,
  imageUrls: string[],
  caption: string,
): Promise<string> {
  if (imageUrls.length === 1) {
    console.log(`[Cron:Instagram] 단일 이미지 게시물 발행 시도...`);
    const containerRes = await fetch(`${IG_API}/${ig_user_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrls[0], caption, access_token }),
    });
    const container = await containerRes.json();
    if (!container.id) {
      console.error(`[Cron:Instagram] 단일 컨테이너 생성 실패: ${container.error?.message || JSON.stringify(container.error)}`);
      throw new Error(container.error?.message || '컨테이너 생성 실패');
    }
    console.log(`[Cron:Instagram] 단일 컨테이너 생성 성공 - Container ID: ${container.id}`);

    // 컨테이너 처리 완료 대기 (status_code == FINISHED)
    await waitForContainerReady(container.id, access_token);

    console.log(`[Cron:Instagram] media_publish 시도 (Creation ID: ${container.id})...`);
    const publishRes = await fetch(`${IG_API}/${ig_user_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token }),
    });
    const published = await publishRes.json();
    if (!published.id) {
      console.error(`[Cron:Instagram] media_publish 실패: ${published.error?.message || JSON.stringify(published.error)}`);
      throw new Error(published.error?.message || '발행 실패');
    }
    console.log(`[Cron:Instagram] media_publish 성공 - IG Post ID: ${published.id}`);
    return published.id;
  } else {
    const slideUrls = imageUrls.slice(0, 10);
    console.log(`[Cron:Instagram] 카로셀 게시물 발행 시도 (총 ${slideUrls.length}개 슬라이드)...`);
    const childIds: string[] = [];
    for (let i = 0; i < slideUrls.length; i++) {
      console.log(`[Cron:Instagram] 슬라이드 #${i + 1}/${slideUrls.length} 하위 컨테이너 생성 중...`);
      const childId = await createChildContainer(ig_user_id, access_token, slideUrls[i]);
      // 각 하위 컨테이너 처리 완료 대기 (status_code == FINISHED)
      await waitForContainerReady(childId, access_token);
      childIds.push(childId);
    }

    console.log(`[Cron:Instagram] 카로셀 부모 컨테이너 생성 시도 (Children: ${childIds.length}개)...`);
    const carouselRes = await fetch(`${IG_API}/${ig_user_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption,
        access_token,
      }),
    });
    const carousel = await carouselRes.json();
    if (!carousel.id) {
      console.error(`[Cron:Instagram] 카로셀 부모 컨테이너 생성 실패: ${carousel.error?.message || JSON.stringify(carousel.error)}`);
      throw new Error(carousel.error?.message || '카로셀 컨테이너 생성 실패');
    }
    console.log(`[Cron:Instagram] 카로셀 부모 컨테이너 생성 성공 - Carousel ID: ${carousel.id}`);

    // 카로셀 부모 컨테이너 처리 완료 대기 (status_code == FINISHED)
    await waitForContainerReady(carousel.id, access_token);

    console.log(`[Cron:Instagram] 카로셀 media_publish 시도 (Creation ID: ${carousel.id})...`);
    const publishRes = await fetch(`${IG_API}/${ig_user_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: carousel.id, access_token }),
    });
    const published = await publishRes.json();
    if (!published.id) {
      console.error(`[Cron:Instagram] 카로셀 media_publish 실패: ${published.error?.message || JSON.stringify(published.error)}`);
      throw new Error(published.error?.message || '카로셀 발행 실패');
    }
    console.log(`[Cron:Instagram] 카로셀 media_publish 성공 - IG Post ID: ${published.id}`);
    return published.id;
  }
}

// Vercel Cron: 매시간 정각 실행 (vercel.json에 설정)
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const now = new Date();
  const kstTimeStr = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');

  console.log(`[Cron:Instagram] === Cron 실행 시작 ===`);
  console.log(`[Cron:Instagram] UTC 시각: ${now.toISOString()} | KST 시각: ${kstTimeStr}`);

  const authHeader = request.headers.get('authorization');
  const isAuthValid = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  console.log(`[Cron:Instagram] Auth 헤더 검증: ${isAuthValid ? '성공 (Valid)' : '실패 (Unauthorized)'}`);

  if (!isAuthValid) {
    console.warn(`[Cron:Instagram] Unauthorized 요청 차단 (Header: ${authHeader ? '존재함' : '없음'})`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[Cron:Instagram] pending 게시물 조회 중 (scheduled_at <= ${now.toISOString()})...`);
  const { data: posts, error: fetchErr } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now.toISOString());

  if (fetchErr) {
    console.error(`[Cron:Instagram] DB 게시물 조회 실패: ${fetchErr.message}`);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const fetchedCount = posts ? posts.length : 0;
  console.log(`[Cron:Instagram] 조회된 pending 게시물 수: ${fetchedCount}건`);

  if (!posts || posts.length === 0) {
    const totalElapsedMs = Date.now() - startTime;
    console.log(`[Cron:Instagram] 발행 대상 게시물 없음. 종료 (총 소요시간: ${totalElapsedMs}ms)`);
    return NextResponse.json({ message: '발행할 게시물 없음', processed: 0 });
  }

  posts.forEach((p, idx) => {
    const slideCount = p.slide_image_urls?.length ?? (p.thumbnail_url ? 1 : 0);
    console.log(`[Cron:Instagram] [게시물 #${idx + 1}] ID: ${p.id} | 예약시각: ${p.scheduled_at} | 이미지 수: ${slideCount}개`);
  });

  console.log(`[Cron:Instagram] instagram_settings 연동 정보 조회 중...`);
  const { data: settings } = await supabase
    .from('instagram_settings')
    .select('access_token, ig_user_id')
    .limit(1)
    .maybeSingle();

  const hasSettings = !!settings;
  const hasIgUserId = !!(settings?.ig_user_id);
  const hasAccessToken = !!(settings?.access_token);

  console.log(`[Cron:Instagram] 설정 정보 - Settings 존재: ${hasSettings} | ig_user_id 존재: ${hasIgUserId} | access_token 존재: ${hasAccessToken}`);

  if (!settings || !settings.ig_user_id || !settings.access_token) {
    console.error(`[Cron:Instagram] Instagram 설정 미비로 발행 불가 (Settings: ${hasSettings}, ig_user_id: ${hasIgUserId}, access_token: ${hasAccessToken})`);
    return NextResponse.json({ error: 'Instagram 설정 없음 — 연동 필요' }, { status: 400 });
  }

  const { access_token, ig_user_id } = settings;
  const results: { id: string; success: boolean; error?: string; slide_count?: number }[] = [];

  let successCount = 0;
  let failCount = 0;
  let remainingCount = 0;
  const MAX_EXEC_MS = 240000; // 240초 (4분) 전체 실행 타임아웃 안전 임계값

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const elapsedMs = Date.now() - startTime;

    if (elapsedMs > MAX_EXEC_MS) {
      remainingCount = posts.length - i;
      console.warn(`[Cron:Instagram] 전체 실행 시간 240초 초과 (${(elapsedMs / 1000).toFixed(1)}s). 남은 ${remainingCount}건은 다음 실행으로 미룹니다 (pending 상태 유지).`);
      break;
    }

    const postStartTime = Date.now();
    console.log(`[Cron:Instagram] ---> [게시물 ID: ${post.id}] 처리 시작 (예약시각: ${post.scheduled_at})`);

    // slide_image_urls 우선, 없으면 thumbnail_url 폴백
    const imageUrls: string[] = (post.slide_image_urls?.length ? post.slide_image_urls : null)
      ?? (post.thumbnail_url ? [post.thumbnail_url] : []);

    if (imageUrls.length === 0) {
      console.warn(`[Cron:Instagram] [게시물 ID: ${post.id}] 이미지 URL 없음 -> status=failed 업데이트`);
      await supabase.from('scheduled_posts').update({ status: 'failed', error_message: '이미지 URL 없음' }).eq('id', post.id);
      results.push({ id: post.id, success: false, error: '이미지 URL 없음' });
      failCount++;
      continue;
    }

    try {
      const fullCaption = post.hashtags ? `${post.caption}\n\n${post.hashtags}` : post.caption;
      const igPostId = await publishToInstagram(ig_user_id, access_token, imageUrls, fullCaption);

      const postElapsedMs = Date.now() - postStartTime;
      console.log(`[Cron:Instagram] [게시물 ID: ${post.id}] 발행 성공! (IG Post ID: ${igPostId}, 소요시간: ${postElapsedMs}ms)`);

      await supabase.from('scheduled_posts').update({ status: 'published', ig_post_id: igPostId }).eq('id', post.id);
      results.push({ id: post.id, success: true, slide_count: imageUrls.length });
      successCount++;
    } catch (e: any) {
      const postElapsedMs = Date.now() - postStartTime;
      console.error(`[Cron:Instagram] [게시물 ID: ${post.id}] 발행 실패 (에러: ${e.message}, 소요시간: ${postElapsedMs}ms)`);

      await supabase.from('scheduled_posts').update({ status: 'failed', error_message: e.message }).eq('id', post.id);
      results.push({ id: post.id, success: false, error: e.message });
      failCount++;
    }
  }

  const totalElapsedMs = Date.now() - startTime;
  console.log(`[Cron:Instagram] === Cron 실행 종료 ===`);
  console.log(`[Cron:Instagram] 총 대상: ${posts.length}건 | 처리: ${results.length}건 | 성공: ${successCount}건 | 실패: ${failCount}건 | 이월(Pending): ${remainingCount}건 | 총 소요시간: ${totalElapsedMs}ms`);

  return NextResponse.json({
    processed: results.length,
    total: posts.length,
    remaining: remainingCount,
    results,
  });
}
