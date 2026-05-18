import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const IG_API = 'https://graph.instagram.com/v21.0';

async function createSinglePost(ig_user_id: string, access_token: string, imageUrl: string, caption: string) {
  const res = await fetch(`${IG_API}/${ig_user_id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || '미디어 생성 실패');
  if (!data.id) throw new Error('미디어 컨테이너 ID를 받지 못했습니다');
  return data.id as string;
}

async function createChildContainer(ig_user_id: string, access_token: string, imageUrl: string) {
  const res = await fetch(`${IG_API}/${ig_user_id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, is_carousel_item: true, access_token }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || `하위 컨테이너 생성 실패 (${imageUrl})`);
  if (!data.id) throw new Error('하위 컨테이너 ID를 받지 못했습니다');
  return data.id as string;
}

async function publishContainer(ig_user_id: string, access_token: string, creationId: string) {
  const res = await fetch(`${IG_API}/${ig_user_id}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationId, access_token }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || '발행 실패');
  if (!data.id) throw new Error('발행 ID를 받지 못했습니다');
  return data.id as string;
}

export async function POST(request: NextRequest) {
  try {
    // imageUrls: 다중 이미지(카로셀), imageUrl: 단일(하위 호환)
    const { postId, imageUrls, imageUrl, caption, hashtags } = await request.json();

    const urls: string[] = imageUrls?.length ? imageUrls : imageUrl ? [imageUrl] : [];

    if (urls.length === 0) {
      return NextResponse.json({ error: '이미지 URL이 없습니다. 공개 접근 가능한 이미지 URL이 필요합니다.' }, { status: 400 });
    }

    const { data: settings, error: settingsErr } = await supabase
      .from('instagram_settings')
      .select('access_token, ig_user_id')
      .limit(1)
      .maybeSingle();

    if (settingsErr || !settings) {
      return NextResponse.json({ error: 'Instagram 설정이 없습니다. 먼저 연동 설정을 완료하세요.' }, { status: 400 });
    }

    const { access_token, ig_user_id } = settings;
    const fullCaption = hashtags ? `${caption}\n\n${hashtags}` : caption;

    let igPostId: string;

    if (urls.length === 1) {
      // 단일 이미지
      const containerId = await createSinglePost(ig_user_id, access_token, urls[0], fullCaption);
      igPostId = await publishContainer(ig_user_id, access_token, containerId);
    } else {
      // 카로셀 (최대 10장)
      const slideUrls = urls.slice(0, 10);

      // 1. 각 슬라이드 하위 컨테이너 생성
      const childIds: string[] = [];
      for (const url of slideUrls) {
        const childId = await createChildContainer(ig_user_id, access_token, url);
        childIds.push(childId);
      }

      // 2. 카로셀 컨테이너 생성
      const carouselRes = await fetch(`${IG_API}/${ig_user_id}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          children: childIds.join(','),
          caption: fullCaption,
          access_token,
        }),
      });
      const carousel = await carouselRes.json();
      if (carousel.error) throw new Error(carousel.error.message || '카로셀 컨테이너 생성 실패');
      if (!carousel.id) throw new Error('카로셀 컨테이너 ID를 받지 못했습니다');

      // 3. 발행
      igPostId = await publishContainer(ig_user_id, access_token, carousel.id);
    }

    if (postId) {
      await supabase
        .from('scheduled_posts')
        .update({ status: 'published', ig_post_id: igPostId })
        .eq('id', postId);
    }

    return NextResponse.json({ success: true, ig_post_id: igPostId, slide_count: urls.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
