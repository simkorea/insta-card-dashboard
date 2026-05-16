import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const [designsRes, postsRes, templatesRes, commentsRes] = await Promise.all([
      supabase.from('card_designs').select('id, name, created_at, pages_data').order('created_at', { ascending: false }).limit(6),
      supabase.from('scheduled_posts').select('id, design_name, thumbnail_url, caption, scheduled_at, status').order('scheduled_at', { ascending: true }).limit(5),
      supabase.from('card_designs').select('id', { count: 'exact', head: true }),
      supabase.from('comment_templates').select('id', { count: 'exact', head: true }),
    ]);

    const pendingPosts = (postsRes.data ?? []).filter((p: any) => p.status !== 'published');
    const publishedCount = (postsRes.data ?? []).filter((p: any) => p.status === 'published').length;

    // 이번주 생성 수
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: weeklyCount } = await supabase
      .from('card_designs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo);

    return NextResponse.json({
      stats: {
        totalDesigns: templatesRes.count ?? 0,
        pendingPosts: pendingPosts.length,
        commentTemplates: commentsRes.count ?? 0,
        weeklyCreated: weeklyCount ?? 0,
      },
      recentDesigns: designsRes.data ?? [],
      upcomingPosts: pendingPosts.slice(0, 5),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
