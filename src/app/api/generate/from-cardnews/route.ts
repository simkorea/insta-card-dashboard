import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pagesToBlogSource } from '@/lib/cardnews/pagesToBlogSource';
import { buildNarration } from '@/lib/cardnews/narration';
import { buildVideoTitle, buildVideoCaption } from '@/lib/cardnews/videoMeta';

// 카드뉴스 한 벌로 블로그 글까지 한 번에 만든다.
//
// 지금까지는 카드뉴스를 만든 뒤 블로그 화면으로 옮겨 다시 고르고 생성을
// 눌러야 했다. 재료(카드 내용)는 이미 있는데 사람이 화면을 옮겨 다니는 게
// 일의 대부분이었다.
//
// 영상은 여기서 만들지 않는다. 브라우저가 캔버스를 실시간으로 녹화해야 해서
// 서버에서 끝낼 수 없다. 대신 영상 화면이 곧바로 쓸 수 있도록 제목·캡션·
// 내레이션 대본을 같이 돌려준다.

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { designId, format = 'naver', tone = 'professional' } = await request.json();
    if (!designId) {
      return NextResponse.json({ error: 'designId가 필요합니다.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Supabase 설정이 없습니다.' }, { status: 500 });
    }
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: design, error: designErr } = await supabase
      .from('card_designs')
      .select('id, name, pages_data')
      .eq('id', designId)
      .maybeSingle();

    if (designErr) return NextResponse.json({ error: designErr.message }, { status: 500 });
    if (!design) return NextResponse.json({ error: '카드뉴스를 찾을 수 없습니다.' }, { status: 404 });

    const pages = Array.isArray(design.pages_data) ? design.pages_data : [];
    if (pages.length === 0) {
      return NextResponse.json({ error: '카드 내용이 비어 있습니다.' }, { status: 400 });
    }

    // 카드의 리드 문장·표·체크리스트·출처까지 근거로 넘긴다.
    // 제목만 넘기면 AI가 나머지를 지어낸다 (예전에 그래서 엉뚱한 글이 나왔다).
    const source = pagesToBlogSource(pages);

    // 블로그 생성 라우트는 미들웨어가 로그인으로 막고 있다.
    // 서버끼리 부르는 것이라 쿠키가 자동으로 따라가지 않아, 들어온 요청의
    // 세션 쿠키를 그대로 실어 보낸다. 안 그러면 '로그인이 필요합니다'로 막힌다.
    const origin = new URL(request.url).origin;
    const blogRes = await fetch(`${origin}/api/generate/blog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ topic: source, format, tone }),
    });
    const blog = await blogRes.json();
    if (!blogRes.ok || blog.error) {
      return NextResponse.json(
        { error: blog.error || '블로그 생성에 실패했습니다.' },
        { status: blogRes.status === 200 ? 500 : blogRes.status },
      );
    }

    // 만든 글을 보관한다. 실패해도 글 자체는 돌려준다 — 다시 만들게 하는 것보다 낫다.
    let blogPostId: string | null = null;
    const { data: saved, error: saveErr } = await supabase
      .from('blog_posts')
      .insert({
        title: blog.title || design.name,
        body: blog.body || '',
        meta_description: blog.metaDescription || null,
        tags: blog.tags || null,
        topic: design.name,
        format,
      })
      .select('id')
      .maybeSingle();
    if (!saveErr && saved) blogPostId = saved.id;

    return NextResponse.json({
      success: true,
      blogPostId,
      blogSaved: Boolean(blogPostId),
      blog: { title: blog.title, body: blog.body, metaDescription: blog.metaDescription, tags: blog.tags },
      // 영상 화면이 바로 쓸 수 있는 재료
      video: {
        title: buildVideoTitle(pages, design.name),
        caption: buildVideoCaption(pages, design.name),
        narration: buildNarration(pages),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '알 수 없는 오류' }, { status: 500 });
  }
}
