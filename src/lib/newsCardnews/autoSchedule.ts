import { createClient } from '@supabase/supabase-js';
import { captureDesignSlides } from '@/lib/cardnews/captureSlides';
import { buildVideoCaption } from '@/lib/cardnews/videoMeta';

// 오늘 아침에 만들어진 뉴스 카드뉴스 초안을 발행 대기 줄에 올린다.
//
// 아침 크론이 초안을 만들지만 그림 파일이 없어서 여태 사람이 화면에서
// 캡처해 예약해야 했다. 여기서 서버가 직접 그려 scheduled_posts 에 넣으면
// 기존 발행 크론이 그대로 집어 올린다 — 발행 코드는 건드리지 않는다.

const AUTO_CATEGORY = '자동 뉴스';

function kstDayRangeUtc(now = new Date()) {
  const kstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  const dayStartUtcMs =
    new Date(kstNow.toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime() - 9 * 3600 * 1000;
  return { startIso: new Date(dayStartUtcMs).toISOString() };
}

export type AutoScheduleResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; designId: string; name: string; slides: number; postId: string }
  | { ok: false; error: string };

/**
 * @param budgetMs 카드를 그리는 데 쓸 수 있는 시간. 크론 전체 예산에서 떼어 준다.
 */
export async function scheduleTodayNewsCardnews(budgetMs = 120_000): Promise<AutoScheduleResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: 'Supabase 설정이 없습니다.' };

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { startIso } = kstDayRangeUtc();

  // 1) 오늘 만들어진 자동 초안
  const { data: design, error: dErr } = await supabase
    .from('card_designs')
    .select('id, name, pages_data')
    .eq('category', AUTO_CATEGORY)
    .gte('created_at', startIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dErr) return { ok: false, error: `초안 조회 실패: ${dErr.message}` };
  if (!design) return { ok: true, skipped: true, reason: '오늘 만들어진 자동 초안이 없습니다.' };

  const pages = Array.isArray(design.pages_data) ? design.pages_data : [];

  // 2) 같은 초안이 이미 줄에 서 있거나 올라갔으면 그만둔다.
  //    크론이 두 번 돌아도 같은 글이 두 번 올라가면 안 된다.
  const { data: dup } = await supabase
    .from('scheduled_posts')
    .select('id, status')
    .eq('design_id', design.id)
    .limit(1)
    .maybeSingle();
  if (dup) return { ok: true, skipped: true, reason: `이미 ${dup.status} 상태로 등록돼 있습니다.` };

  // 3) 안전장치 — 카드가 모자라면 올리지 않는다.
  //    빈 카드가 공개 계정에 올라가는 것보다 하루 거르는 편이 낫다.
  if (pages.length < 3) {
    return { ok: true, skipped: true, reason: `카드가 ${pages.length}장뿐이라 올리지 않습니다.` };
  }
  const emptyPages = pages.filter(
    (p: { blocks?: unknown[] }) => !Array.isArray(p?.blocks) || p.blocks.length === 0,
  ).length;
  if (emptyPages > 0) {
    return { ok: true, skipped: true, reason: `내용이 빈 카드가 ${emptyPages}장 있어 올리지 않습니다.` };
  }

  // 4) 서버에서 그린다
  const shot = await captureDesignSlides(design.id, budgetMs);
  if (!shot.ok) return { ok: false, error: shot.error };
  if (shot.urls.length !== pages.length) {
    return { ok: false, error: `카드 ${pages.length}장 중 ${shot.urls.length}장만 그려졌습니다.` };
  }

  // 5) 발행 대기 줄에 넣는다. 시각은 지금 — 이 크론이 곧바로 이어서 올린다.
  const caption = buildVideoCaption(pages as never, design.name);
  const { data: post, error: insErr } = await supabase
    .from('scheduled_posts')
    .insert({
      design_id: design.id,
      design_name: design.name,
      thumbnail_url: shot.urls[0],
      slide_image_urls: shot.urls.slice(0, 10),
      caption,
      hashtags: [],
      scheduled_at: new Date().toISOString(),
      status: 'pending',
    })
    .select('id')
    .single();

  if (insErr) return { ok: false, error: `예약 저장 실패: ${insErr.message}` };

  console.log(`[AutoSchedule] ${design.name} ${shot.urls.length}장 발행 대기 등록`);
  return {
    ok: true,
    skipped: false,
    designId: design.id,
    name: design.name,
    slides: shot.urls.length,
    postId: post.id,
  };
}
