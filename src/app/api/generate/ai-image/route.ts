import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const sizeMap: Record<string, '1024x1024' | '1024x1792' | '1792x1024'> = {
  '1:1': '1024x1024',
  '4:5': '1024x1024',
  '3:4': '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY 미설정' }, { status: 500 });

  try {
    const { prompt, ratio = '1:1', count = 1 } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ error: '프롬프트를 입력하세요' }, { status: 400 });

    const size = sizeMap[ratio] || '1024x1024';
    const n = Math.min(Math.max(1, count), 4);

    // DALL-E 3는 n=1만 지원 → 병렬 요청
    const requests = Array.from({ length: n }, () =>
      fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'dall-e-3', prompt: prompt.slice(0, 1000), n: 1, size, quality: 'standard' }),
      }).then(r => r.json())
    );

    const results = await Promise.all(requests);
    const urls: string[] = [];
    for (const r of results) {
      if (r.data?.[0]?.url) urls.push(r.data[0].url);
      else if (r.error) throw new Error(r.error.message || 'DALL-E 오류');
    }

    return NextResponse.json({ urls });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
