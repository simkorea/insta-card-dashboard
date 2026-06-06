import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { hook, topic } = await request.json();
    
    if (!hook) {
      return NextResponse.json({ error: 'hook is required' }, { status: 400 });
    }

    const topicContext = topic ? `\n참고 카드뉴스 주제/맥락: "${topic}"` : '';
    
    const prompt = `당신은 카드뉴스 기획 및 카피라이팅 전문가입니다. 
인스타그램 카드뉴스 표지(첫 번째 슬라이드)의 제목(바이럴 훅)에 어울리는 짧은 표지 본문(subtitle)을 작성해주세요.

[입력 정보]
- 표지 제목: "${hook}"${topicContext}

[작성 요구사항]
1. 제목에 관심을 가진 사람들이 본문(다음 슬라이드)을 읽고 싶게 만드는 자연스러운 후킹(hooking) 톤으로 작성하세요.
2. 길이는 2~3문장 내외의 짧고 간결한 분량으로 한국어로 작성하세요.
3. 과도한 이모지 사용은 금지하고, 텍스트의 가독성과 세련미를 살려주세요.
4. 완성된 표지 본문 텍스트만 단 답변으로 바로 출력하세요. 부가적인 설명이나 따옴표 등은 제외하세요.`;

    const generatedBody = await generateWithRetry(prompt);
    
    // Clean up potential markdown formatting or quotes
    let cleanedBody = generatedBody.trim();
    if (cleanedBody.startsWith('"') && cleanedBody.endsWith('"')) {
      cleanedBody = cleanedBody.slice(1, -1).trim();
    }
    if (cleanedBody.startsWith('`') && cleanedBody.endsWith('`')) {
      cleanedBody = cleanedBody.slice(1, -1).trim();
    }

    return NextResponse.json({ body: cleanedBody });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
