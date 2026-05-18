import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let urlContent = '';
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CardNewsBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      const html = await res.text();
      urlContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000);
    } catch {
      urlContent = `URL: ${url} (콘텐츠를 직접 가져올 수 없어 URL 정보만으로 생성합니다)`;
    }

    const prompt = `당신은 탁월한 콘텐츠 에디터입니다.
다음 기사 또는 웹페이지 내용을 분석하고, 핵심 내용만 뽑아서
실제 카드뉴스 템플릿에 바로 복사/붙여넣기 할 수 있는 수준으로 완벽하게 요약해 주세요.

원본 URL: ${url}

페이지 내용:
${urlContent}

[요구사항]
1. 링크된 내용의 핵심 주제와 주요 정보(수치 등)를 반드시 포함할 것.
2. 카드뉴스 장수에 맞게 명확히 분리할 것 ([1장 표지], [2장 본문], [3장 본문], [4장 본문], [5장 결론])
3. 글자 수 제한: 각 장(슬라이드)마다 텍스트는 3문장 이내, 총 100자를 넘지 않도록 아주 간결하게 핵심만 작성할 것.
4. 불필요한 설명 없이 즉시 사용할 수 있는 대본 텍스트만 반환할 것.`;

    const text = await generateWithRetry(prompt);
    return NextResponse.json({ text });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
