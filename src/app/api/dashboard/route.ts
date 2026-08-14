import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export async function GET() {
  try {
    const [designsRes, postsRes, templatesRes, commentsRes, briefingRes] = await Promise.all([
      supabase.from('card_designs').select('id, name, created_at, pages_data').order('created_at', { ascending: false }).limit(6),
      supabase.from('scheduled_posts').select('id, design_name, thumbnail_url, caption, scheduled_at, status').order('scheduled_at', { ascending: true }).limit(5),
      supabase.from('card_designs').select('id', { count: 'exact', head: true }),
      supabase.from('comment_templates').select('id', { count: 'exact', head: true }),
      supabaseService
        ? supabaseService.from('briefings').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle()
        : supabase.from('briefings').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    // 아침 뉴스로 자동 생성된 카드뉴스 초안 (사람이 확인 후 발행하는 대기 항목)
    const { data: newsDraft } = await supabase
      .from('card_designs')
      .select('id, name, created_at, pages_data')
      .eq('category', '자동 뉴스')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 목록에 보여줄 대기 건 (가장 이른 5건)
    const pendingPosts = (postsRes.data ?? []).filter((p: any) => p.status !== 'published');

    // 개수는 따로 센다.
    // 위 목록은 limit(5)로 5건만 가져오므로 그걸 세면 아무리 밀려 있어도
    // 최대 5로 보인다. 대기가 20건인데 5라고 뜨면 볼 이유가 없는 숫자가 된다.
    const { count: pendingCount } = await supabase
      .from('scheduled_posts')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'published');

    // 이번주 생성 수
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: weeklyCount } = await supabase
      .from('card_designs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo);

    // ── 오늘 할 일 ────────────────────────────────────────────────────────
    // 누적 숫자(저장된 디자인 81, 댓글 템플릿 67)는 매일 봐도 할 일이 안 보인다.
    // 실제 하루는 '아침 초안 확인 → 다듬기 → 발행 → 블로그·영상 전환'이라
    // 그 흐름에서 막혀 있는 것만 센다.
    const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const [recentAllRes, publishedRes, nextPostRes] = await Promise.all([
      // pages_data는 무거워서 뺀다 — 개수와 이름만 필요하다
      supabase.from('card_designs').select('id, name, created_at')
        .gte('created_at', since14).order('created_at', { ascending: false }),
      supabase.from('scheduled_posts').select('design_id').eq('status', 'published'),
      supabase.from('scheduled_posts').select('scheduled_at, design_name')
        .neq('status', 'published').order('scheduled_at', { ascending: true }).limit(1).maybeSingle(),
    ]);

    const publishedIds = new Set(
      (publishedRes.data ?? []).map((p: any) => String(p.design_id)).filter(Boolean)
    );
    const unpublished = (recentAllRes.data ?? []).filter((d: any) => !publishedIds.has(String(d.id)));

    // ── 오늘의 소재 ───────────────────────────────────────────────────────
    // 예전에는 화면에 'AI 업무 자동화', '건강한 식습관' 같은 고정 문자열 6개를
    // 박아 뒀다. 부동산 계정에 아무 상관 없는 키워드라 누를 이유가 없었다.
    // 오늘 아침 브리핑이 실제로 모아 온 기사 제목을 쓴다.
    const newsItems = Array.isArray(briefingRes.data?.news_items) ? briefingRes.data.news_items : [];
    const topics = newsItems
      .map((n: any) => ({ title: String(n?.title || '').trim(), link: n?.link || '' }))
      .filter((n: any) => n.title)
      .slice(0, 8);

    // ── 자동 작업 상태 ────────────────────────────────────────────────────
    // 8/6~8/7에 아침 크론이 조용히 죽었는데 며칠 뒤에야 알았다. 알림을 보낼
    // 수단(이메일·슬랙)이 없고 크론 로그 테이블도 없다.
    //
    // 그래서 남은 흔적으로 되짚는다. 브리핑이 있으면 수집이 돌았고, '자동 뉴스'
    // 카드뉴스가 있으면 초안까지 갔다. 최근 7일을 늘어놓으면 빠진 날이 한눈에
    // 보인다 — 표를 새로 만들지 않아도 되고, 지난 사고도 이 화면이었으면
    // 그날 바로 눈에 띄었을 것이다.
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [briefWeekRes, draftWeekRes, failedRes] = await Promise.all([
      // briefings 는 RLS가 걸려 있어 anon 키로는 0건이 온다.
      // 위 briefingRes 가 supabaseService 를 쓰는 이유와 같다 — 여기서 그걸
      // 놓쳐서 '7일 중 7일 빠짐'이라고 잘못 표시됐다.
      (supabaseService || supabase).from('briefings').select('created_at').gte('created_at', since7),
      supabase.from('card_designs').select('created_at').eq('category', '자동 뉴스').gte('created_at', since7),
      supabase.from('scheduled_posts').select('id, design_name, error_message, scheduled_at')
        .eq('status', 'failed').order('scheduled_at', { ascending: false }).limit(3),
    ]);

    // 한국 날짜로 묶는다 (크론은 한국 시간 아침에 돈다)
    const kstDay = (iso: string) =>
      new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const briefDays = new Set((briefWeekRes.data ?? []).map((b: any) => kstDay(b.created_at)));
    const draftDays = new Set((draftWeekRes.data ?? []).map((d: any) => kstDay(d.created_at)));

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() + 9 * 3600 * 1000 - (6 - i) * 24 * 3600 * 1000);
      const key = d.toISOString().slice(0, 10);
      return {
        date: key,
        label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
        briefing: briefDays.has(key),
        draft: draftDays.has(key),
      };
    });

    let isBriefingSaved = false;
    if (briefingRes.data) {
      const dbClient = supabaseService || supabase;
      const { count } = await dbClient
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('briefing_id', briefingRes.data.id);
      if (count && count > 0) isBriefingSaved = true;
    }

    return NextResponse.json({
      stats: {
        totalDesigns: templatesRes.count ?? 0,
        pendingPosts: pendingCount ?? pendingPosts.length,
        commentTemplates: commentsRes.count ?? 0,
        weeklyCreated: weeklyCount ?? 0,
      },
      todo: {
        // 오늘 아침 초안이 있는지 (있으면 확인·다듬기가 첫 일이다)
        hasDraft: Boolean(newsDraft),
        draftSlides: Array.isArray((newsDraft as any)?.pages_data) ? (newsDraft as any).pages_data.length : 0,
        // 만들어 놓고 아직 인스타에 안 올린 카드뉴스 (최근 2주)
        unpublishedCount: unpublished.length,
        unpublished: unpublished.slice(0, 3).map((d: any) => ({ id: d.id, name: d.name, created_at: d.created_at })),
        // 예약 대기와 가장 이른 발행 시각
        pendingCount: pendingCount ?? pendingPosts.length,
        nextScheduledAt: nextPostRes.data?.scheduled_at ?? null,
        nextScheduledName: nextPostRes.data?.design_name ?? null,
      },
      topics,
      health: {
        days,
        // 오늘 것이 빠졌는지 (한국 시간 기준). 크론은 아침에 도는데, 이른
        // 아침에 아직 안 돈 것과 죽은 것을 구분하려고 시각도 같이 보낸다.
        kstHour: Number(new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(11, 13)),
        failedPosts: failedRes.data ?? [],
      },
      recentDesigns: designsRes.data ?? [],
      upcomingPosts: pendingPosts.slice(0, 5),
      briefing: briefingRes.data || null,
      isBriefingSaved,
      newsDraft: newsDraft || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
