import type { SupabaseClient } from '@supabase/supabase-js';
import { getSlideImageUrls } from '@/lib/cardnews/slideImages';
import { pagesToBlogSource } from '@/lib/cardnews/pagesToBlogSource';
import { checkSlideImageUrls } from '@/lib/blog/slideUrlGuard';

// 카드뉴스 한 벌 → 블로그 글(+카드 그림 주소). 저장은 하지 않는다.
//
// 원래 src/app/api/generate/from-cardnews/route.ts 안에 있던 앞부분(카드뉴스 읽기 →
// 근거 만들기 → 블로그 생성 → 카드 그림 구하기)을 그대로 옮겼다. HTTP 경로
// (from-cardnews)와 MCP 도구(cardnews_to_blog)가 같은 코드를 부르게 하려는 것이다.
//
// 여기서 하지 않는 일: blog_posts 저장, 영상 재료(제목·캡션·대본). 그건 from-cardnews 가
// 이 함수가 돌려준 값으로 계속 한다. MCP 도구는 저장하지 않는다.
//
// 블로그를 '어떻게' 부르는지만 호출하는 쪽이 정한다(generateBlog).
//   - from-cardnews: 같은 서버의 /api/generate/blog 를 세션 쿠키와 함께 부른다(예전 그대로).
//   - MCP: 쿠키가 없으므로 같은 본체(generateBlogPost)를 직접 부른다.
// 둘 다 결국 같은 생성 코드(lib/blog/generateBlogPost.ts)에 닿는다.

export type BlogDraft = {
  title?: string;
  body?: string;
  metaDescription?: string;
  tags?: string[];
};

export type GenerateBlogArgs = { topic: string; format: string; tone: string };
export type GenerateBlogResult =
  | { ok: true; blog: BlogDraft }
  | { ok: false; status: number; error: string };

export type CardnewsBlogResult =
  | {
      ok: true;
      design: { id: string; name: string };
      // from-cardnews 가 영상 재료를 만들 때 쓴다 (pages_data 그대로)
      pages: unknown[];
      blog: BlogDraft;
      slideUrls: string[];
    }
  | { ok: false; status: number; error: string };

export async function generateBlogFromCardnews(opts: {
  supabase: SupabaseClient;
  designId: string;
  format: string;
  tone: string;
  generateBlog: (args: GenerateBlogArgs) => Promise<GenerateBlogResult>;
  // 호출하는 쪽이 이미 그려 둔 그림 주소. 주면 새로 구하지(그리지) 않고 이 주소를 그대로 쓴다.
  // 안 주면 예전처럼 getSlideImageUrls 가 구한다 (from-cardnews 는 이걸 안 쓴다).
  slideImageUrls?: string[];
}): Promise<CardnewsBlogResult> {
  const { supabase, designId, format, tone, generateBlog, slideImageUrls } = opts;

  const { data: design, error: designErr } = await supabase
    .from('card_designs')
    .select('id, name, pages_data')
    .eq('id', designId)
    .maybeSingle();

  if (designErr) return { ok: false, status: 500, error: designErr.message };
  if (!design) return { ok: false, status: 404, error: '카드뉴스를 찾을 수 없습니다.' };

  const pages = Array.isArray(design.pages_data) ? design.pages_data : [];
  if (pages.length === 0) {
    return { ok: false, status: 400, error: '카드 내용이 비어 있습니다.' };
  }

  // 넘어온 그림 주소는 AI 를 부르기 전에 검사한다 — 거절할 거면 비용이 들기 전에 거절해야 한다.
  // 개수는 슬라이드 수(pages.length)와 같아야 해서 카드뉴스를 읽은 뒤에야 검사할 수 있다.
  if (slideImageUrls) {
    const reason = checkSlideImageUrls({
      urls: slideImageUrls,
      designId,
      slideCount: pages.length,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    if (reason) return { ok: false, status: 400, error: reason };
  }

  // 카드의 리드 문장·표·체크리스트·출처까지 근거로 넘긴다.
  // 제목만 넘기면 AI가 나머지를 지어낸다 (예전에 그래서 엉뚱한 글이 나왔다).
  const source = pagesToBlogSource(pages);

  const generated = await generateBlog({ topic: source, format, tone });
  if (!generated.ok) return generated;

  // 카드 그림도 같이 구한다.
  //
  // 화면에서 카드뉴스를 골라 만들면 카드가 그림으로 들어가는데, 이 길로
  // 만든 글은 글만 저장돼서 다시 열면 이미지가 0장이었다. 인스타에 올리며
  // 이미 그려 둔 그림이 있으면 그걸 그대로 쓰고, 없으면 서버에서 그린다.
  const slideUrls = slideImageUrls ?? (await getSlideImageUrls(designId, 120_000));

  return {
    ok: true,
    design: { id: design.id, name: design.name },
    pages,
    blog: generated.blog,
    slideUrls,
  };
}
