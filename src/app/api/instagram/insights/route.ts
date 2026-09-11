import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// scheduled_posts·instagram_settings 는 서버 전용이다 (service role).
// 키가 없다고 anon 으로 넘어가지 않는다. RLS 를 닫은 뒤에는 anon 이
// 빈 결과만 받아 성과가 0으로 보인다 — 여기서 멈춰 실패가 드러나게 한다.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const IG_API = 'https://graph.facebook.com/v21.0';

export async function GET() {
  // Load IG settings
  const { data: settings } = await supabase
    .from('instagram_settings')
    .select('access_token, ig_user_id')
    .limit(1)
    .maybeSingle();

  if (!settings) {
    return NextResponse.json({ error: 'Instagram 미연결' }, { status: 400 });
  }

  // Fetch published posts that have an ig_post_id
  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('id, design_name, thumbnail_url, caption, hashtags, scheduled_at, ig_post_id')
    .eq('status', 'published')
    .not('ig_post_id', 'is', null)
    .order('scheduled_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!posts || posts.length === 0) return NextResponse.json({ insights: [] });

  // Fetch metrics from Instagram Graph API for each post
  const insights = await Promise.all(
    posts.map(async (post) => {
      try {
        const fields = 'like_count,comments_count,timestamp,media_url,permalink';
        const res = await fetch(
          `${IG_API}/${post.ig_post_id}?fields=${fields}&access_token=${settings.access_token}`
        );
        const ig = await res.json();

        // Fetch impressions + reach separately (requires insights endpoint)
        const insightRes = await fetch(
          `${IG_API}/${post.ig_post_id}/insights?metric=impressions,reach&access_token=${settings.access_token}`
        );
        const insightData = await insightRes.json();
        const metricsMap: Record<string, number> = {};
        if (insightData.data) {
          for (const m of insightData.data) {
            metricsMap[m.name] = m.values?.[0]?.value ?? m.value ?? 0;
          }
        }

        return {
          id: post.id,
          ig_post_id: post.ig_post_id,
          design_name: post.design_name,
          thumbnail_url: post.thumbnail_url,
          caption: post.caption,
          scheduled_at: post.scheduled_at,
          permalink: ig.permalink ?? null,
          like_count: ig.like_count ?? 0,
          comments_count: ig.comments_count ?? 0,
          impressions: metricsMap['impressions'] ?? 0,
          reach: metricsMap['reach'] ?? 0,
        };
      } catch {
        return {
          id: post.id,
          ig_post_id: post.ig_post_id,
          design_name: post.design_name,
          thumbnail_url: post.thumbnail_url,
          caption: post.caption,
          scheduled_at: post.scheduled_at,
          permalink: null,
          like_count: 0,
          comments_count: 0,
          impressions: 0,
          reach: 0,
        };
      }
    })
  );

  return NextResponse.json({ insights });
}
