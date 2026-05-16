import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const IG_API = 'https://graph.facebook.com/v21.0';

async function createChildContainer(ig_user_id: string, access_token: string, imageUrl: string) {
  const res = await fetch(`${IG_API}/${ig_user_id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, is_carousel_item: true, access_token }),
  });
  const data = await res.json();
  if (!data.id) throw new Error(data.error?.message || '하위 컨테이너 생성 실패');
  return data.id as string;
}

async function publishToInstagram(
  ig_user_id: string,
  access_token: string,
  imageUrls: string[],
  caption: string,
): Promise<string> {
  if (imageUrls.length === 1) {
    // 단일 이미지
    const containerRes = await fetch(`${IG_API}/${ig_user_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrls[0], caption, access_token }),
    });
    const container = await containerRes.json();
    if (!container.id) throw new Error(container.error?.message || '컨테이너 생성 실패');

    const publishRes = await fetch(`${IG_API}/${ig_user_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token }),
    });
    const published = await publishRes.json();
    if (!published.id) throw new Error(published.error?.message || '발행 실패');
    return published.id;
  } else {
    // 카로셀
    const slideUrls = imageUrls.slice(0, 10);
    const childIds: string[] = [];
    for (const url of slideUrls) {
      childIds.push(await createChildContainer(ig_user_id, access_token, url));
    }

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
    if (!carousel.id) throw new Error(carousel.error?.message || '카로셀 컨테이너 생성 실패');

    const publishRes = await fetch(`${IG_API}/${ig_user_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: carousel.id, access_token }),
    });
    const published = await publishRes.json();
    if (!published.id) throw new Error(published.error?.message || '카로셀 발행 실패');
    return published.id;
  }
}

// Vercel Cron: 매시간 정각 실행 (vercel.json에 설정)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  const { data: posts, error: fetchErr } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now.toISOString());

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!posts || posts.length === 0) {
    return NextResponse.json({ message: '발행할 게시물 없음', processed: 0 });
  }

  const { data: settings } = await supabase
    .from('instagram_settings')
    .select('access_token, ig_user_id')
    .limit(1)
    .maybeSingle();

  if (!settings) {
    return NextResponse.json({ error: 'Instagram 설정 없음 — 연동 필요' }, { status: 400 });
  }

  const { access_token, ig_user_id } = settings;
  const results: { id: string; success: boolean; error?: string; slide_count?: number }[] = [];

  for (const post of posts) {
    // slide_image_urls 우선, 없으면 thumbnail_url 폴백
    const imageUrls: string[] = (post.slide_image_urls?.length ? post.slide_image_urls : null)
      ?? (post.thumbnail_url ? [post.thumbnail_url] : []);

    if (imageUrls.length === 0) {
      await supabase.from('scheduled_posts').update({ status: 'failed', error_message: '이미지 URL 없음' }).eq('id', post.id);
      results.push({ id: post.id, success: false, error: '이미지 URL 없음' });
      continue;
    }

    try {
      const fullCaption = post.hashtags ? `${post.caption}\n\n${post.hashtags}` : post.caption;
      const igPostId = await publishToInstagram(ig_user_id, access_token, imageUrls, fullCaption);

      await supabase.from('scheduled_posts').update({ status: 'published', ig_post_id: igPostId }).eq('id', post.id);
      results.push({ id: post.id, success: true, slide_count: imageUrls.length });
    } catch (e: any) {
      await supabase.from('scheduled_posts').update({ status: 'failed', error_message: e.message }).eq('id', post.id);
      results.push({ id: post.id, success: false, error: e.message });
    }
  }

  return NextResponse.json({ processed: posts.length, results });
}
