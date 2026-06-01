import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    if (!image) return NextResponse.json({ error: '이미지가 필요합니다' }, { status: 400 });

    const mimeType = image.startsWith('data:image/png') ? 'image/png'
      : image.startsWith('data:image/webp') ? 'image/webp'
      : 'image/jpeg';
    const data = image.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `이 카드뉴스 슬라이드 이미지를 정밀하게 분석하여, 동일한 디자인 구조의 편집 가능한 템플릿 JSON을 만들어주세요.

분석 항목:
1. 배경 이미지의 종류와 분위기 (도시, 건물, 자연, 실내 등)
2. 다크 오버레이의 방향과 강도
3. 텍스트 배치 위치 (중앙 정렬인지, 좌하단인지, 리스트형인지)
4. 제목의 크기, 굵기, 색상
5. 강조색 (노란색, 빨간색 등)
6. 글머리 기호(bullet) 항목 수와 스타일
7. 레이아웃에 해당하는 구조화된 "blocks" 배열 구성 (각 요소들을 SlideBlock 형태로 맵핑)
8. 어울리는 브랜드 톤 (brandTone: 'gold' 또는 'sage')과 프레임 노출 여부 (showFrame: true 또는 false)

반드시 코드블록 없이 JSON만 응답하세요:
{
  "imageKeyword": "Pexels 검색용 영어 키워드 (예: dark night city skyline, modern architecture)",
  "overlay": "배경 CSS 오버레이 값 (예: linear-gradient(to top, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.35) 100%))",
  "layout": "center 또는 bottom-left 또는 bottom-left-list",
  "title": "이 슬라이드에 있는 실제 제목 텍스트 그대로",
  "subtitle": "이 슬라이드 부제목 텍스트 (없으면 빈 문자열)",
  "accent": "강조색 HEX (예: #ffd700, #ef4444, #3b82f6)",
  "bullets": ["실제 글머리 항목 텍스트들을 배열로"],
  "titleStyle": {
    "fontSize": 제목 크기 숫자 (20~52),
    "fontWeight": "900",
    "color": "제목 색상 HEX"
  },
  "subtitleStyle": {
    "fontSize": 부제목 크기 숫자 (12~20),
    "fontWeight": "400",
    "color": "부제목 색상 HEX"
  },
  "bulletStyle": {
    "fontSize": 글머리 크기 숫자 (12~18),
    "fontWeight": "400",
    "color": "#FFFFFF"
  },
  "brandTone": "gold 또는 sage",
  "showFrame": true 또는 false,
  "blocks": [
    // 아래 10가지 타입 중 이미지 내용에 매칭되는 블록들을 순서대로 배열로 구성:
    // 1) { "type": "eyebrow", "text": "섹션 라벨 텍스트" }
    // 2) { "type": "headline", "text": "헤드라인 전체 텍스트", "accentText": "강조할 일부 단어(있으면)" }
    // 3) { "type": "sub", "text": "설명/서브 텍스트" }
    // 4) { "type": "bigNumber", "value": "큰 숫자값 (예: 7억대)", "caption": "설명/캡션" }
    // 5) { "type": "statGrid", "cols": 2 | 3 | 4, "items": [{"value": "수치값", "label": "라벨"}] }
    // 6) { "type": "compareTable", "rows": [{"label": "구분", "value": "설명", "highlight": true|false}] }
    // 7) { "type": "timeline", "items": [{"date": "날짜", "title": "제목", "desc": "설명", "state": "done"|"active"|"todo"}] }
    // 8) { "type": "checklist", "items": ["체크리스트 내용들"] }
    // 9) { "type": "badgeRow", "badges": [{"text": "태그명", "tone": "gold"|"green"|"neutral"}] }
    // 10) { "type": "sourceNote", "text": "출처 정보 (예: 국토교통부)" }
  ]
}`;

    let text = (await generateWithRetry({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data } },
          { text: prompt },
        ],
      }],
    })).trim();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const template = JSON.parse(text);

    // blocks, brandTone, showFrame에 대한 하위 호환성 보장 로직 추가
    if (!template.blocks || !Array.isArray(template.blocks)) {
      const fallbackBlocks = [];
      if (template.title) {
        fallbackBlocks.push({ type: 'headline', text: template.title });
      }
      if (template.subtitle) {
        fallbackBlocks.push({ type: 'sub', text: template.subtitle });
      }
      if (template.bullets && Array.isArray(template.bullets) && template.bullets.length > 0) {
        fallbackBlocks.push({ type: 'checklist', items: template.bullets });
      }
      template.blocks = fallbackBlocks;
    }
    if (!template.brandTone) {
      template.brandTone = 'gold';
    }
    if (template.showFrame === undefined) {
      template.showFrame = true;
    }

    return NextResponse.json({ template });
  } catch (e: any) {
    return NextResponse.json({ error: toKoreanError(e) }, { status: 500 });
  }
}
