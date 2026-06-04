import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { source, sceneCount = 5 } = await request.json();

    if (!source) {
      return NextResponse.json({ error: 'source가 필요합니다' }, { status: 400 });
    }

    const prompt = `당신은 비디오 생성 AI(예: Kling, Luma Dream Machine, Runway Gen-2)에 입력할 영상 생성 프롬프트 전문가입니다.
다음 내용(주제 또는 카드뉴스 텍스트)을 분석하여, 내용의 흐름에 어울리는 연속성 있는 장면을 정확히 ${sceneCount}개 구성하고 각 장면에 맞는 영어 영상 생성 프롬프트를 작성해주세요.

[입력 내용]
${source}

[작성 조건]
1. 정확히 ${sceneCount}개의 장면을 순차적으로 구성해야 합니다.
2. 한국 부동산, 아파트, 인테리어, 도시 전경, 그리고 라이프스타일 콘텐츠 맥락에 알맞게 장면을 구상하세요.
3. 인물의 얼굴 클로즈업(Close-up)이나 영상 내 인공적인 텍스트 삽입(Text Rendering) 묘사는 비디오 생성 AI에서 왜곡을 방지하기 위해 절대 피하십시오.
4. 각 장면 프롬프트는 쉼표(,)로 구분된 단어와 구절의 나열 형태(영어)로 작성하세요. 다음 요소를 필수로 포함하십시오:
   - 장면 구체적 묘사 (예: A modern cozy living room with soft lighting, dust motes in air)
   - 카메라 무빙 (예: slow dolly zoom in, subtle panning shot)
   - 분위기/조명 (예: warm volumetric light, cinematic, photorealistic, 4k)
5. 한글로 된 한 줄짜리 장면 요약 설명('ko')을 포함하여 반드시 아래 지정된 JSON 배열 형식으로만 응답하십시오 (설명 텍스트나 코드블록 없이 JSON만 반환):

[
  {
    "scene": 1,
    "ko": "아파트 거실에 부드러운 햇살이 비추며 먼지가 날리는 차분한 분위기",
    "prompt": "a cozy modern apartment living room, warm soft afternoon sunlight streaming through window, dust motes floating in the light, slow dolly zoom in, cinematic, photorealistic, 4k"
  },
  ...
]`;

    let text = (await generateWithRetry(prompt)).trim();
    if (text.includes('```json')) {
      text = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      text = text.split('```')[1].split('```')[0].trim();
    }

    const scenes = JSON.parse(text);
    return NextResponse.json({ scenes });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
