import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // published 게시물 중 ig_post_id 있는 것만 (인사이트 데이터가 있는 것)
    const { data: posts, error } = await supabase
      .from('scheduled_posts')
      .select('scheduled_at, status')
      .eq('status', 'published')
      .not('scheduled_at', 'is', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!posts || posts.length === 0) {
      return NextResponse.json({ slots: [], message: '발행 데이터가 없습니다. 게시물을 발행하면 분석이 시작됩니다.' });
    }

    const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
    const hourBuckets: Record<string, { count: number; days: number[] }> = {};

    posts.forEach(p => {
      const d = new Date(p.scheduled_at);
      const hour = d.getHours();
      const day = d.getDay();
      const key = `${hour}`;
      if (!hourBuckets[key]) hourBuckets[key] = { count: 0, days: [] };
      hourBuckets[key].count++;
      if (!hourBuckets[key].days.includes(day)) hourBuckets[key].days.push(day);
    });

    // 시간대별 점수 (발행 많이 한 시간 = 더 잘 되는 시간이라 가정)
    const slots = Object.entries(hourBuckets)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        label: `${hour.padStart(2, '0')}:00`,
        count: data.count,
        days: data.days.sort().map(d => DAYS[d]),
        score: data.count,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // 요일별 발행 횟수
    const dayCounts = Array(7).fill(0);
    posts.forEach(p => {
      dayCounts[new Date(p.scheduled_at).getDay()]++;
    });

    const dayStats = DAYS.map((label, i) => ({ label, count: dayCounts[i] }));

    // 시간대 히트맵 (0-23시, 0-6요일)
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    posts.forEach(p => {
      const d = new Date(p.scheduled_at);
      heatmap[d.getDay()][d.getHours()]++;
    });

    return NextResponse.json({ slots, dayStats, heatmap, totalPosts: posts.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
