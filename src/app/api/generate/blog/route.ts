import { NextResponse } from 'next/server';
import { toKoreanError } from '@/lib/gemini';
import { generateBlogPost } from '@/lib/blog/generateBlogPost';

// 생성 본체는 src/lib/blog/generateBlogPost.ts 에 있다. 이 라우트는 요청을 풀고
// 결과를 NextResponse 로 감쌀 뿐이다 — MCP 도구(cardnews_to_blog)가 같은 본체를 쓴다.

// 60초로는 지금 구성에서 긴 글이 절대 안 나온다.
//
// Gemini 월 결제 한도가 차 있어서 0.6초 만에 429로 떨어지고, 실제 글은
// OpenRouter(deepseek)가 쓴다. 3천자짜리 한 편에 65초쯤 걸린다 —
// 재보고 확인한 숫자다. 그런데 아래 내부 제한이 50초라, 분량을 올려 두면
// 매번 '시간 초과'만 떴다. 가끔 실패한 게 아니라 항상 실패였다.
//
// /api/briefing 이 이미 300초를 쓰고 있어 요금제상 여유는 있다.
//
// 같은 이유로 프롬프트에 있던 '시간 초과 방지를 위해 1800~2300자 엄수'도
// 뺐다. 화면 슬라이더는 3천자까지 올라가는데 프롬프트가 2300자로 못을
// 박고 있어서, 분량을 올려도 글이 안 길어지고 실패만 했다. 이제 슬라이더
// 값이 그대로 목표 분량이 된다.
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const { status, json } = await generateBlogPost(input);
    return NextResponse.json(json, { status });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
