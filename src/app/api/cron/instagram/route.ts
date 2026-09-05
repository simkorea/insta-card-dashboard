import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scheduleTodayNewsCardnews } from '@/lib/newsCardnews/autoSchedule';
import { saveBriefingAsBlog } from '@/lib/blog/saveBriefingAsBlog';
import { recordRun } from '@/lib/automation/recordRun';

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

// 아침 10시(KST) 자동 처리.
//
// 하는 일이 셋이다. 순서가 곧 우선순위다 — 시간이 모자라면 뒤가 밀린다.
//   1. 오늘 만들어진 뉴스 카드뉴스 초안을 서버에서 그려 발행 줄에 넣는다
//   2. 발행 대기 중인 게시물을 인스타에 올린다 (1번이 넣은 것 포함)
//   3. 오늘 브리핑으로 블로그 글을 만들어 보관함에 저장한다
//
// Vercel Hobby 는 크론을 2개까지만 준다. 그래서 하나로 묶었다.
// 함수 한도가 300초라 단계마다 남은 시간을 보고 진행 여부를 정한다.
export const maxDuration = 300;

const RENDER_BUDGET_MS = 110_000;  // 카드 그리기에 줄 시간
const PUBLISH_CUTOFF_MS = 200_000; // 이 시각을 넘기면 남은 발행은 다음으로 미룬다
const BLOG_CUTOFF_MS = 200_000;    // 이 시각을 넘겼으면 블로그는 건너뛴다

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const now = new Date();
  const kstTimeStr = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');
  const elapsed = () => Date.now() - startTime;

  console.log(`[Cron:Instagram] === Cron 실행 시작 ===`);
  console.log(`[Cron:Instagram] UTC 시각: ${now.toISOString()} | KST 시각: ${kstTimeStr}`);

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn(`[Cron:Instagram] Unauthorized 요청 차단 (Header: ${authHeader ? '존재함' : '없음'})`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 1. 오늘 카드뉴스 초안 → 그림 → 발행 줄 ───────────────────────────
  let autoCard: unknown;
  // 블로그에도 같은 카드를 그림으로 넣는다. 방금 인스타용으로 그린 것을
  // 그대로 쓰므로 두 번 그리지 않는다.
  let autoDesignId: string | undefined;
  try {
    const r = await scheduleTodayNewsCardnews(RENDER_BUDGET_MS);
    autoCard = r;
    if (r.ok) autoDesignId = r.designId;
    if (!r.ok) console.error('[Cron:Instagram] 카드뉴스 자동 등록 실패:', r.error);
    else if (r.skipped) console.log('[Cron:Instagram] 카드뉴스 자동 등록 건너뜀:', r.reason);
    else console.log(`[Cron:Instagram] 카드뉴스 자동 등록: ${r.name} ${r.slides}장`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    autoCard = { ok: false, error: msg };
    console.error('[Cron:Instagram] 카드뉴스 자동 등록 중 예외:', msg);
  }
  {
    const r = autoCard as { ok?: boolean; skipped?: boolean; reason?: string; error?: string; name?: string };
    await recordRun('cardnews', Boolean(r?.ok), r?.error ?? r?.reason ?? r?.name, elapsed());
  }

  // ── 2. 블로그 저장 ───────────────────────────────────────────────────
  //
  // 발행보다 먼저 한다. 예전에는 발행 뒤에 뒀는데, 카로셀 10장 발행이
  // 100초 넘게 걸리는 날에는 남은 시간이 모자라 블로그가 잘려나갔다 —
  // 9/3, 9/4 가 실제로 그랬다(발행은 됐고 블로그만 없다).
  //
  // 순서를 바꿔도 그림은 붙는다. 카드는 1번에서 이미 그려 두었고 블로그는
  // 그 주소를 그대로 물려받는다. 블로그는 20초짜리라 발행을 늦추지도 않는다.
  let blog: unknown;
  if (elapsed() > BLOG_CUTOFF_MS) {
    blog = { ok: false, error: `시간이 모자라 건너뜀 (${(elapsed() / 1000).toFixed(1)}s 경과)` };
    console.warn('[Cron:Instagram] 블로그 저장 건너뜀 — 남은 시간 부족');
  } else {
    try {
      const r = await saveBriefingAsBlog(undefined, autoDesignId);
      blog = r;
      if (!r.ok) console.error('[Cron:Instagram] 블로그 저장 실패:', r.error);
      else if (r.skipped) console.log('[Cron:Instagram] 블로그 저장 건너뜀:', r.reason);
      else console.log(`[Cron:Instagram] 블로그 저장: ${r.title}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      blog = { ok: false, error: msg };
      console.error('[Cron:Instagram] 블로그 저장 중 예외:', msg);
    }
  }
  {
    const r = blog as { ok?: boolean; skipped?: boolean; reason?: string; error?: string; title?: string };
    await recordRun('blog', Boolean(r?.ok), r?.error ?? r?.reason ?? r?.title, elapsed());
  }

  // ── 3. 발행 ──────────────────────────────────────────────────────────
  const publishNow = new Date();
  console.log(`[Cron:Instagram] pending 게시물 조회 중 (scheduled_at <= ${publishNow.toISOString()})...`);
  const { data: posts, error: fetchErr } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', publishNow.toISOString());

  const results: { id: string; success: boolean; error?: string; slide_count?: number }[] = [];
  let successCount = 0;
  let failCount = 0;
  let remainingCount = 0;

  if (fetchErr) {
    console.error(`[Cron:Instagram] DB 게시물 조회 실패: ${fetchErr.message}`);
  } else if (!posts || posts.length === 0) {
    console.log('[Cron:Instagram] 발행 대상 게시물 없음');
  } else {
    console.log(`[Cron:Instagram] 조회된 pending 게시물 수: ${posts.length}건`);

    const { data: settings } = await supabase
      .from('instagram_settings')
      .select('access_token, ig_user_id')
      .limit(1)
      .maybeSingle();

    if (!settings?.ig_user_id || !settings?.access_token) {
      console.error('[Cron:Instagram] Instagram 설정 미비로 발행 불가 — 연동 필요');
    } else {
      const { access_token, ig_user_id } = settings;

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];

        if (elapsed() > PUBLISH_CUTOFF_MS) {
          remainingCount = posts.length - i;
          console.warn(`[Cron:Instagram] 시간 초과 (${(elapsed() / 1000).toFixed(1)}s). 남은 ${remainingCount}건은 다음 실행으로 미룹니다.`);
          break;
        }

        const postStartTime = Date.now();
        console.log(`[Cron:Instagram] ---> [게시물 ID: ${post.id}] 처리 시작 (예약시각: ${post.scheduled_at})`);

        const imageUrls: string[] = (post.slide_image_urls?.length ? post.slide_image_urls : null)
          ?? (post.thumbnail_url ? [post.thumbnail_url] : []);

        if (imageUrls.length === 0) {
          console.warn(`[Cron:Instagram] [게시물 ID: ${post.id}] 이미지 URL 없음 -> status=failed`);
          await supabase.from('scheduled_posts').update({ status: 'failed', error_message: '이미지 URL 없음' }).eq('id', post.id);
          results.push({ id: post.id, success: false, error: '이미지 URL 없음' });
          failCount++;
          continue;
        }

        try {
          const fullCaption = post.hashtags?.length ? `${post.caption}

${post.hashtags}` : post.caption;
          const igPostId = await publishToInstagram(ig_user_id, access_token, imageUrls, fullCaption);

          console.log(`[Cron:Instagram] [게시물 ID: ${post.id}] 발행 성공! (IG Post ID: ${igPostId}, ${Date.now() - postStartTime}ms)`);
          await supabase.from('scheduled_posts').update({ status: 'published', ig_post_id: igPostId }).eq('id', post.id);
          results.push({ id: post.id, success: true, slide_count: imageUrls.length });
          successCount++;
        } catch (e: any) {
          console.error(`[Cron:Instagram] [게시물 ID: ${post.id}] 발행 실패 (${e.message}, ${Date.now() - postStartTime}ms)`);
          await supabase.from('scheduled_posts').update({ status: 'failed', error_message: e.message }).eq('id', post.id);
          results.push({ id: post.id, success: false, error: e.message });
          failCount++;
        }
      }
    }
  }


  await recordRun(
    'publish',
    failCount === 0 && successCount > 0,
    successCount > 0
      ? `성공 ${successCount}건${failCount ? `, 실패 ${failCount}건` : ''}${remainingCount ? `, 이월 ${remainingCount}건` : ''}`
      : (posts && posts.length ? `실패 ${failCount}건` : '올릴 게시물이 없었습니다'),
    elapsed(),
  );

  console.log(`[Cron:Instagram] === Cron 실행 종료 === 성공: ${successCount} | 실패: ${failCount} | 이월: ${remainingCount} | 총 ${elapsed()}ms`);

  return NextResponse.json({
    autoCard,
    blog,
    processed: results.length,
    total: posts?.length ?? 0,
    remaining: remainingCount,
    results,
  });
}
