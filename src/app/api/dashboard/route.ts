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
