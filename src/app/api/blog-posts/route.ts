import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { title, body, metaDescription, tags, images, topic, format } = await request.json();

    if (!body) {
      return NextResponse.json({ error: 'body 내용이 필요합니다' }, { status: 400 });
    }

    const titleFallback = title?.trim() || topic?.trim() || '제목 없는 블로그 글';

    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title: titleFallback,
        body,
        meta_description: metaDescription?.trim() || null,
        tags: tags || [],
        images_data: images || [],
        topic: topic?.trim() || null,
        format: format || null
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error in blog_posts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, post: data });
  } catch (err) {
    console.error('blog-posts POST error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase select error in blog_posts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ posts: data });
  } catch (err) {
    console.error('blog-posts GET error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
