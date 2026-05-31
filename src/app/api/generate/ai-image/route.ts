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
  const apiKey = process.env.LEONARDO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'LEONARDO_API_KEY 미설정' }, { status: 500 });

  try {
    const { prompt, ratio = '4:5', count = 1 } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ error: '프롬프트를 입력하세요' }, { status: 400 });

    // 레오나르도 비율 매핑 (최대 지원 크기에 맞춤)
    let width = 768;
    let height = 960;
    if (ratio === '1:1') { width = 1024; height = 1024; }
    else if (ratio === '16:9') { width = 1024; height = 576; }
    else if (ratio === '9:16') { width = 576; height = 1024; }

    const negativePrompt = "text, letters, words, numbers, watermark, signature, logo, caption, label, distortion, fisheye, lens distortion, warped, skewed, perspective distortion, blurry, out of focus, low quality, pixelated, jpeg artifacts, noise, grain, people, faces, humans, person, crowd, cartoon, illustration, painting, drawing, anime, 3d render, cgi, overexposed, underexposed, bad composition, cropped";

    const payload = {
      height,
      width,
      modelId: "05ce0082-2d80-4a2d-8653-4d1c85e2418e", // Lucid Realism
      prompt: prompt.slice(0, 1000),
      negative_prompt: negativePrompt,
      num_images: Math.min(Math.max(1, count), 4)
    };

    const res = await fetch("https://cloud.leonardo.ai/api/rest/v1/generations", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data?.sdGenerationJob?.generationId) {
       throw new Error(data.error || 'Leonardo API 생성 요청 오류');
    }

    const generationId = data.sdGenerationJob.generationId;

    // 생성 완료까지 대기 (최대 30초)
    let imageUrls: string[] = [];
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const checkRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
        headers: {
          "accept": "application/json",
          "authorization": `Bearer ${apiKey}`
        }
      });
      const checkData = await checkRes.json();
      const status = checkData?.generations_by_pk?.status;
      
      if (status === 'COMPLETE') {
        const images = checkData.generations_by_pk.generated_images;
        imageUrls = images.map((img: any) => img.url);
        break;
      } else if (status === 'FAILED') {
        throw new Error('Leonardo API 생성 실패');
      }
    }

    if (imageUrls.length === 0) {
      throw new Error('이미지 생성 시간 초과');
    }

    return NextResponse.json({ urls: imageUrls });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
