import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { callAI } from '@/lib/ai/openrouter';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url, originalText, templateTitle } = await request.json();

    let inputContent = originalText || '';

    if (url && !originalText) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CardNewsBot/1.0)' },
          signal: AbortSignal.timeout(8000),
        });
        const html = await res.text();
        inputContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 3000);
      } catch {
        inputContent = `URL: ${url} (콘텐츠를 직접 가져올 수 없어 URL 정보만으로 생성합니다)`;
      }
    }

    if (!inputContent) {
      return NextResponse.json({ error: 'Input (URL or text) is required' }, { status: 400 });
    }

    const prompt = `당신은 프로페셔널한 SNS 마케터이자 전문 카피라이터입니다.
제공된 내용을 바탕으로 카드뉴스(5장), 블로그 포스팅, 바이럴 후킹 문구를 생성하세요.
사용자가 선택한 템플릿 스타일(${templateTitle || '일반'})을 고려하여 톤앤매너와 이미지 키워드를 결정하세요.

반드시 아래 JSON 구조로 응답하세요:
{
  "cardNews": [
    { "page": 1, "title": "문자열", "body": "문자열", "imageKeyword": "영어 키워드" }
  ],
  "blogPost": "마크다운 문자열",
  "viralHooks": ["훅1", "훅2", "훅3"]
}

[지침]
1. cardNews: 반드시 5장을 생성할 것.
2. blogPost: 마크다운 형식을 지키되, 줄바꿈은 \\n으로 처리하여 JSON 형식을 깨뜨리지 말 것.
3. imageKeyword: Unsplash 검색용 영어 키워드. 템플릿 스타일 '${templateTitle}' 반영.

내용: ${inputContent}`;

    // let text = await generateWithRetry(prompt);
    let text = await callAI({
      prompt,
      model: 'anthropic/claude-haiku-4.5',
    });

    try {
      if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
      else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      console.error('[unified] JSON 파싱 실패. 원본 응답:', text);
      return NextResponse.json({
        error: 'AI 응답 데이터 형식이 올바르지 않습니다. 다시 시도해 주세요.',
        raw: text.slice(0, 100),
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[unified] 생성 실패 원본 에러:', error);
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
