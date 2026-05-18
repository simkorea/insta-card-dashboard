import { generateWithRetry } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, cardContent } = await request.json();

    if (!imageUrl && !cardContent) {
      return NextResponse.json({ error: 'imageUrl or cardContent required' }, { status: 400 });
    }

    if (cardContent) {
      const prompt = `You are helping find stock photos for a Korean card news/infographic slide about real estate, finance, or economics.

Card news content:
"""
${cardContent}
"""

Generate a concise English search query (3-5 words) for Pexels stock photos that visually represents the TOPIC of this card news.

CRITICAL RULES:
- Output MUST be English words ONLY — absolutely no Korean characters
- 3 to 5 English words, no punctuation
- Focus on the main subject (real estate, finance, construction, etc.)
- Think like a photo editor choosing a cinematic background image

Topic → Query examples (use as guidance):
부동산 시장 금리 동결 → interest rate financial graph
한국은행 기준금리 → central bank interest rate chart
아파트 전세가 상승 → apartment building urban residential
수도권 공급 확대 → housing construction development aerial
투자 청약 전략 → real estate investment strategy business
실거주 자금 계획 → family home purchase financial planning
부동산 뉴스 리포트 → city skyline urban real estate

Return ONLY the English query words, nothing else:`;

      const text = await generateWithRetry(prompt);
      const query = text
        .trim()
        .replace(/^["']|["']$/g, '')
        .split('\n')[0];

      return NextResponse.json({ query });
    }

    // imageUrl 비전 분석
    let imagePart: { inlineData: { mimeType: string; data: string } };
    try {
      const imgResponse = await fetch(imageUrl);
      const arrayBuffer = await imgResponse.arrayBuffer();
      const data = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = imgResponse.headers.get('content-type') ?? 'image/jpeg';
      imagePart = { inlineData: { mimeType, data } };
    } catch {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
    }

    const textPrompt = `Analyze this image. Generate a concise English search query (3-5 words) to find similar stock photos on Pexels.
Focus on subject matter, setting, and mood.
Return ONLY the search query, nothing else.`;

    const result = await model.generateContent([imagePart, textPrompt]);
    const query = result.response.text()
      .trim()
      .replace(/^["']|["']$/g, '')
      .split('\n')[0];

    return NextResponse.json({ query });
  } catch (err) {
    console.error('suggest-image-search error:', err);
    return NextResponse.json({ error: 'Failed to analyze' }, { status: 500 });
  }
}
