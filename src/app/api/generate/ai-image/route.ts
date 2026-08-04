import { NextRequest, NextResponse } from 'next/server';
import { uploadNotebookImage } from '@/lib/notebookImage/upload';

// 블로그 본문에 넣을 AI 이미지 생성.
//
// 예전에는 Leonardo만 썼는데 LEONARDO_API_KEY가 없어 화면이 계속 "준비 중"이었다.
// 카드뉴스에서 이미 쓰고 있는 Gemini 이미지 모델로 먼저 시도하고,
// Leonardo 키가 있으면 그쪽으로 넘어간다. 새 키 없이도 동작하게 하는 게 목적이다.

export const maxDuration = 120;

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';
const IMAGE_MODELS = ['gemini-3-pro-image', 'gemini-3-pro-image-preview'];

/** 비율을 그림 지시문으로 바꾼다. 이 API는 크기 파라미터를 받지 않는다. */
function ratioHint(ratio: string): string {
  switch (ratio) {
    case '1:1': return '정사각형(1:1)';
    case '16:9': return '가로로 긴 와이드(16:9)';
    case '9:16': return '세로로 긴(9:16)';
    case '3:4': return '세로(3:4)';
    default: return '세로(4:5)';
  }
}

async function generateWithGemini(
  key: string,
  prompt: string,
  ratio: string,
  count: number
): Promise<string[]> {
  // 블로그 본문 삽화라 글자가 들어가면 오히려 방해가 된다.
  const full = `${prompt}

[그림 조건]
- 비율 ${ratioHint(ratio)}
- 사진처럼 사실적인 이미지. 일러스트나 3D 렌더링이 아님
- 글자, 숫자, 로고, 워터마크를 절대 넣지 말 것
- 사람 얼굴이 알아볼 수 있게 크게 나오지 않도록 할 것
- 한국의 풍경·건물 맥락에 맞게 그릴 것`;

  const urls: string[] = [];
  for (let i = 0; i < count; i++) {
    let base64: string | null = null;

    for (const model of IMAGE_MODELS) {
      try {
        const res = await fetch(`${GEMINI_API}/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: full }] }],
            generationConfig: { responseModalities: ['IMAGE'] },
          }),
          signal: AbortSignal.timeout(90000),
        });
        if (!res.ok) continue; // Pro가 혼잡하면 다음 모델로
        const data = await res.json();
        base64 = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
          ?.inlineData?.data ?? null;
        if (base64) break;
      } catch {
        /* 다음 모델로 넘어간다 */
      }
    }

    if (!base64) continue;
    // 화면은 URL을 기대한다 — base64를 그대로 넘기면 본문에 박혀버린다
    const url = await uploadNotebookImage(base64, i + 1, 'blog');
    if (url) urls.push(url);
  }
  return urls;
}

async function generateWithLeonardo(
  apiKey: string,
  prompt: string,
  ratio: string,
  count: number
): Promise<string[]> {
  let width = 768;
  let height = 960;
  if (ratio === '1:1') { width = 1024; height = 1024; }
  else if (ratio === '16:9') { width = 1024; height = 576; }
  else if (ratio === '9:16') { width = 576; height = 1024; }

  const negativePrompt = 'text, letters, words, numbers, watermark, signature, logo, caption, label, distortion, fisheye, warped, blurry, out of focus, low quality, pixelated, noise, grain, faces, crowd, cartoon, illustration, painting, anime, 3d render, cgi, overexposed, underexposed, cropped';

  const res = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      height, width,
      modelId: '05ce0082-2d80-4a2d-8653-4d1c85e2418e', // Lucid Realism
      prompt: prompt.slice(0, 1000),
      negative_prompt: negativePrompt,
      num_images: Math.min(Math.max(1, count), 4),
    }),
  });
  const data = await res.json();
  const generationId = data?.sdGenerationJob?.generationId;
  if (!generationId) throw new Error(data.error || 'Leonardo 생성 요청 오류');

  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const checkRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${apiKey}` },
    });
    const checkData = await checkRes.json();
    const status = checkData?.generations_by_pk?.status;
    if (status === 'COMPLETE') {
      return (checkData.generations_by_pk.generated_images || []).map((img: any) => img.url);
    }
    if (status === 'FAILED') throw new Error('Leonardo 생성 실패');
  }
  throw new Error('이미지 생성 시간 초과');
}

export async function POST(req: NextRequest) {
  const gemini = process.env.GEMINI_API_KEY;
  const leonardo = process.env.LEONARDO_API_KEY;
  if (!gemini && !leonardo) {
    return NextResponse.json(
      { error: '이미지 생성 키(GEMINI_API_KEY)가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  try {
    const { prompt, ratio = '4:5', count = 1 } = await req.json();
    if (!prompt?.trim()) {
      return NextResponse.json({ error: '프롬프트를 입력하세요' }, { status: 400 });
    }
    const n = Math.min(Math.max(1, Number(count) || 1), 4);

    if (gemini) {
      const urls = await generateWithGemini(gemini, prompt.trim(), ratio, n);
      if (urls.length > 0) return NextResponse.json({ urls });
      // Gemini가 한 장도 못 만들었고 Leonardo 키도 없으면 여기서 끝
      if (!leonardo) {
        return NextResponse.json(
          { error: '이미지를 만들지 못했습니다. 잠시 뒤 다시 시도해주세요.' },
          { status: 502 }
        );
      }
    }

    const urls = await generateWithLeonardo(leonardo!, prompt.trim(), ratio, n);
    return NextResponse.json({ urls });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '이미지 생성 실패' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    hasKey: Boolean(process.env.GEMINI_API_KEY || process.env.LEONARDO_API_KEY),
  });
}
