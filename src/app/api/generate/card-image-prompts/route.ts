import { NextResponse } from 'next/server';
import { callAI } from '@/lib/ai/openrouter';
import { generateWithRetry, toKoreanError } from '@/lib/gemini';

export const maxDuration = 60;

const styleAnchors: Record<string, string> = {
  trust: 'documentary architectural photography, shot on 35mm film, natural late afternoon light, subdued navy and muted amber tones, subtle film grain',
  impact: 'photojournalistic street photography, available light only, deep natural shadows, desaturated with warm highlights, visible grain',
  info: 'editorial stock photography, soft overcast daylight, plain honest composition, cool grey-blue tones, natural texture',
  soft: 'candid lifestyle photography, soft morning window light, natural imperfections, muted beige and sage tones, gentle grain',
};

const NEGATIVE_PROMPT = "text, letters, words, numbers, watermark, signature, logo, caption, label, distortion, fisheye, lens distortion, warped, skewed, perspective distortion, blurry, out of focus, low quality, pixelated, jpeg artifacts, noise, grain, people, faces, humans, person, crowd, cartoon, illustration, painting, drawing, anime, 3d render, cgi, overexposed, underexposed, bad composition, cropped, digital art, concept art, hyperrealistic, over-saturated, HDR, glossy, plastic look, artificial lighting, overly perfect, perfectly symmetrical, airbrushed, video game graphics";

export async function POST(request: Request) {
  try {
    const { topic, category, slides, presetId = 'trust', count } = await request.json();

    const chosenAnchor = styleAnchors[presetId] || styleAnchors.trust;

    let targetSlides = Array.isArray(slides) && slides.length > 0 ? slides : [];
    if (targetSlides.length === 0) {
      targetSlides = [{ index: 1, title: topic || '카드뉴스', body: '' }];
    }

    // count 지정 시 해당 개수만큼 선택 (1~10)
    if (typeof count === 'number' && count > 0) {
      targetSlides = targetSlides.slice(0, Math.min(count, targetSlides.length));
    }

    const systemPrompt = `당신은 인스타그램 카드뉴스 배경 사진용 프롬프트 전문가다.
최우선 목표 두 가지:
(1) 여러 장이 하나의 시리즈로 보이는 시각적 통일감
(2) AI 생성물처럼 보이지 않고 실제 카메라로 찍은 사진처럼 보일 것

[스타일 앵커 — presetId에 따라 하나 선택, 모든 프롬프트에 토씨 하나 바꾸지 말고 동일하게 포함]
${chosenAnchor}

[공통 규칙 — 모든 프롬프트에 포함]
- dark uncluttered space across the bottom for text overlay
- vertical 4:5 composition

[사진처럼 보이게 하는 규칙 — 매우 중요]
- cinematic, dramatic, epic, hyperrealistic, 8k, ultra detailed, masterpiece, stunning, breathtaking 같은 과장된 단어를 절대 쓰지 말 것. 이런 단어가 AI 티를 만든다.
- 대신 실제 촬영 용어를 쓸 것: 렌즈(35mm, 50mm), 조리개(f/2.8), 자연광 방향, 필름 질감 등.
- 완벽하게 정돈된 장면 대신 평범하고 자연스러운 장면을 묘사할 것.
- 과장된 색보정 대신 절제된 색을 쓸 것.

[작성 규칙]
1. 슬라이드마다 달라지는 것은 오직 "무엇을 찍었는가"(피사체/장면)뿐이다. 스타일 앵커와 공통 규칙 문구는 모든 프롬프트에서 완전히 동일해야 한다.
2. 각 프롬프트는 60~90단어 영어.
3. 1번(표지)은 시선을 끌되 과장 없이, 본문은 더 절제되고 단순하게.
4. 실제 슬라이드 내용과 의미가 연결되어야 한다. 추상적 이미지 남발 금지.
5. 한국 부동산/도시 주제면 한국적 맥락(Korean new town, Seoul apartment complex 등)을 반영할 것.
6. 사람 얼굴은 넣지 말 것. 필요하면 뒷모습이나 실루엣 수준으로만.
7. 순수 JSON 배열만 출력. 코드블록(\`\`\`)이나 설명 문장 금지.

[출력 형식 예시]
[
  {
    "index": 1,
    "prompt": "문장..."
  }
]`;

    const userPrompt = `주제: ${topic || '카드뉴스'}
카테고리: ${category || '일반'}

요청 슬라이드 목록:
${JSON.stringify(targetSlides, null, 2)}`;

    let text = '';
    try {
      text = await callAI({
        prompt: userPrompt,
        system: systemPrompt,
        model: 'anthropic/claude-haiku-4.5',
      });
    } catch {
      text = await generateWithRetry(`${systemPrompt}\n\n${userPrompt}`);
    }

    if (text.includes('```json')) {
      text = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      text = text.split('```')[1].split('```')[0].trim();
    }

    let rawArray: any[] = [];
    try {
      const parsed = JSON.parse(text);
      rawArray = Array.isArray(parsed) ? parsed : (parsed.prompts || []);
    } catch {
      throw new Error('AI 응답을 JSON으로 파싱하지 못했습니다.');
    }

    const prompts = rawArray.map((item: any, idx: number) => {
      const indexNum = item.index || (idx + 1);
      return {
        index: indexNum,
        label: indexNum === 1 ? '1번 · 표지' : `${indexNum}번 · 본문`,
        prompt: String(item.prompt || item.text || '').trim(),
      };
    });

    return NextResponse.json({
      prompts,
      negativePrompt: NEGATIVE_PROMPT,
    });
  } catch (error: any) {
    console.error('[card-image-prompts] 생성 실패:', error);
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
