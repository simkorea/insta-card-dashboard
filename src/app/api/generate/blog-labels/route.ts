import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { blogText, count } = await request.json();
    if (!blogText) {
      return NextResponse.json({ error: 'blogText가 필요합니다' }, { status: 400 });
    }

    const prompt = `당신은 블로그 포스트 분석 및 이미지 추천 전문가입니다.
다음 블로그 포스팅 본문을 읽고, 본문에 들어갈 적절한 이미지의 위치(섹션/대목)와 그에 어울리는 한국어 라벨을 정확히 ${count}개 추천해주세요.

[블로그 본문]
${blogText}

[조건]
- 정확히 ${count}개의 이미지 슬롯에 대한 추천 라벨을 작성해야 합니다.
- 순서대로 글의 도입부, 중간 주요 섹션들, 마무리 부분에 고르게 대응하는 흐름으로 라벨을 설계하세요.
- 각 라벨은 "섹션 이름 - 이미지 추천 컨셉" 형태로 명료하게 15자 내외로 작성하세요.
  예: "도입부 - 차분한 오피스 전경", "섹션 1 - 성장하는 우상향 그래프", "마무리 - 미소 짓는 사람들"
- 반드시 아래 JSON 배열 형식으로만 응답하세요 (코드블록 없이):
[
  "라벨 1",
  "라벨 2",
  ...
]`;

    let text = (await generateWithRetry(prompt)).trim();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const labels = JSON.parse(text);
    return NextResponse.json({ labels });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
