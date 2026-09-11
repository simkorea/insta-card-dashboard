import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// scheduled_posts 는 서버 전용이다 (service role).
// 키가 없다고 anon 으로 넘어가지 않는다. RLS 를 닫은 뒤에는 anon 이
// 빈 결과만 받아서, 저장이 안 된 것을 아무도 모르게 된다.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET() {
  const { data, error } = await supabase
    .from('scheduled_posts')
    .select('*')
    .order('scheduled_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const { design_id, design_name, thumbnail_url, slide_image_urls, caption, hashtags, scheduled_at } = await request.json();

    if (!caption || !scheduled_at) {
      return NextResponse.json({ error: 'caption과 scheduled_at이 필요합니다' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert({ design_id, design_name, thumbnail_url, slide_image_urls: slide_image_urls ?? null, caption, hashtags, scheduled_at, status: 'pending' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ post: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
