import { NextRequest, NextResponse } from 'next/server';
import { toBlogImageSlots } from '@/lib/cardnews/slideImages';
import { createClient } from '@supabase/supabase-js';
import { generateBlogFromCardnews } from '@/lib/cardnews/cardnewsToBlog';
import { buildNarration } from '@/lib/cardnews/narration';
import { buildVideoTitle, buildVideoCaption } from '@/lib/cardnews/videoMeta';
import { withTagLine } from '@/lib/blog/tagLine';

// 카드뉴스 한 벌로 블로그 글까지 한 번에 만든다.
//
// 지금까지는 카드뉴스를 만든 뒤 블로그 화면으로 옮겨 다시 고르고 생성을
// 눌러야 했다. 재료(카드 내용)는 이미 있는데 사람이 화면을 옮겨 다니는 게
// 일의 대부분이었다.
//
// 영상은 여기서 만들지 않는다. 브라우저가 캔버스를 실시간으로 녹화해야 해서
// 서버에서 끝낼 수 없다. 대신 영상 화면이 곧바로 쓸 수 있도록 제목·캡션·
// 내레이션 대본을 같이 돌려준다.
//
// 읽기·생성·카드 그림 구하기는 src/lib/cardnews/cardnewsToBlog.ts 로 옮겼다
// (MCP 도구 cardnews_to_blog 와 같은 코드를 쓴다). 저장과 영상 재료는 여기 남았다.

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

    // 블로그 생성 라우트는 미들웨어가 로그인으로 막고 있다.
    // 서버끼리 부르는 것이라 쿠키가 자동으로 따라가지 않아, 들어온 요청의
    // 세션 쿠키를 그대로 실어 보낸다. 안 그러면 '로그인이 필요합니다'로 막힌다.
    const origin = new URL(request.url).origin;
    const result = await generateBlogFromCardnews({
      supabase,
      designId,
      format,
      tone,
      generateBlog: async ({ topic, format, tone }) => {
        const blogRes = await fetch(`${origin}/api/generate/blog`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: request.headers.get('cookie') || '',
          },
          body: JSON.stringify({ topic, format, tone }),
        });
        const blog = await blogRes.json();
        if (!blogRes.ok || blog.error) {
          return {
            ok: false,
            error: blog.error || '블로그 생성에 실패했습니다.',
            status: blogRes.status === 200 ? 500 : blogRes.status,
          };
        }
        return { ok: true, blog };
      },
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { design, pages, blog, slideUrls } = result;

    // 만든 글을 보관한다. 실패해도 글 자체는 돌려준다 — 다시 만들게 하는 것보다 낫다.
    let blogPostId: string | null = null;
    const { data: saved, error: saveErr } = await supabase
      .from('blog_posts')
      .insert({
        images_data: toBlogImageSlots(slideUrls),
        title: blog.title || design.name,
        // 화면에서 저장할 때와 같게 — 붙여넣으면 태그도 같이 간다
        body: withTagLine(blog.body || '', blog.tags),
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
        title: buildVideoTitle(pages as never, design.name),
        caption: buildVideoCaption(pages as never, design.name),
        narration: buildNarration(pages as never),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '알 수 없는 오류' }, { status: 500 });
  }
}
