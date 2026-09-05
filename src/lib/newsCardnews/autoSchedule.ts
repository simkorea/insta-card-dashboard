import { createClient } from '@supabase/supabase-js';
import { captureDesignSlides } from '@/lib/cardnews/captureSlides';
import { buildVideoCaption } from '@/lib/cardnews/videoMeta';
import { generateNewsCardnewsDraft } from '@/lib/newsCardnews/generateDraft';

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
  | { ok: true; skipped: true; reason: string; designId?: string }
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
  const findToday = () => supabase
    .from('card_designs')
    .select('id, name, pages_data')
    .eq('category', AUTO_CATEGORY)
    .gte('created_at', startIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let { data: design, error: dErr } = await findToday();
  if (dErr) return { ok: false, error: `초안 조회 실패: ${dErr.message}` };

  // 초안이 없으면 여기서 만든다.
  //
  // 아침 크론이 브리핑까지만 하고 초안에서 실패하는 날이 있다 (9/5). 그러면
  // 그날은 카드뉴스도 인스타도 통째로 빈다. 브리핑은 이미 있으니 여기서
  // 이어 만들면 그날치를 살릴 수 있다 — 아침 것과 같은 hybrid 로 만든다.
  if (!design) {
    console.warn('[AutoSchedule] 오늘 초안이 없어 지금 만듭니다 (아침 크론에서 빠진 것으로 보임)');
    const made = await generateNewsCardnewsDraft({ cardStyle: 'hybrid' });
    if (!made.ok) {
      return { ok: false, error: `초안이 없어 새로 만들려 했으나 실패: ${made.error}` };
    }
    ({ data: design } = await findToday());
    if (!design) return { ok: true, skipped: true, reason: '초안을 만들었지만 오늘 것으로 잡히지 않습니다.' };
  }

  const pages = Array.isArray(design.pages_data) ? design.pages_data : [];

  // 2) 오늘 이미 올렸으면 그만둔다.
  //
  // 예전에는 '이 초안이 이미 등록됐는지'만 봤다. 그러면 하루에 초안이 두 개
  // 생겼을 때 둘 다 나간다 — 2026-09-05 에 실제로 그랬다. 아침 초안이 빠져
  // 손으로 채우는 동안 화면에서 '다시 만들기'를 눌러 초안이 하나 더 생겼고,
  // 서로 다른 초안이라 중복 검사를 둘 다 통과해 두 건이 발행됐다.
  //
  // 계정에 하루 두 번 올라가는 것이 사고다. 초안이 몇 개든 하루 한 건으로 막는다.
  const { data: todayPosts } = await supabase
    .from('scheduled_posts')
    .select('id, status, design_id, design_name')
    .gte('created_at', startIso)
    .in('status', ['pending', 'published'])
    .limit(5);

  const already = (todayPosts ?? [])[0];
  if (already) {
    const sameDesign = already.design_id === design.id;
    return {
      ok: true,
      skipped: true,
      designId: design.id,
      reason: sameDesign
        ? `이미 ${already.status} 상태로 등록돼 있습니다.`
        : `오늘은 이미 '${already.design_name}'이(가) ${already.status === 'published' ? '올라갔습니다' : '발행 대기 중입니다'}. 하루 한 건만 올립니다.`,
    };
  }

  // 3) 안전장치 — 카드가 모자라면 올리지 않는다.
  //    빈 카드가 공개 계정에 올라가는 것보다 하루 거르는 편이 낫다.
  if (pages.length < 3) {
    return { ok: true, skipped: true, designId: design.id, reason: `카드가 ${pages.length}장뿐이라 올리지 않습니다.` };
  }
  const emptyPages = pages.filter(
    (p: { blocks?: unknown[] }) => !Array.isArray(p?.blocks) || p.blocks.length === 0,
  ).length;
  if (emptyPages > 0) {
    return { ok: true, skipped: true, designId: design.id, reason: `내용이 빈 카드가 ${emptyPages}장 있어 올리지 않습니다.` };
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
