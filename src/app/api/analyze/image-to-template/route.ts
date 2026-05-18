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
  }
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
    return NextResponse.json({ template });
  } catch (e: any) {
    return NextResponse.json({ error: toKoreanError(e) }, { status: 500 });
  }
}
