import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
