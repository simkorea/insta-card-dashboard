import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function fetchPexelsImage(keyword: string): Promise<string> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return 'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=800&q=80';
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=5&orientation=portrait`,
      { headers: { Authorization: apiKey } }
    );
    const data = await res.json();
    const photo = data.photos?.[Math.floor(Math.random() * Math.min(data.photos.length, 3))];
    return photo?.src?.large || 'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=800&q=80';
  } catch {
    return 'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=800&q=80';
  }
}

export async function POST(request: Request) {
  try {
    const { keyword, category = '일반', slideCount = 7 } = await request.json();
    if (!keyword) return NextResponse.json({ error: '키워드가 필요합니다' }, { status: 400 });

    const count = Math.min(Math.max(Number(slideCount) || 7, 5), 10);

    const prompt = `당신은 인스타그램 카드뉴스 전문 콘텐츠 기획자입니다.
카테고리: ${category}
주제: ${keyword}

다음 구조로 ${count}장의 카드뉴스를 기획하세요:
- 1번: 표지 (강렬한 후킹 제목, layout: center)
- 2번~${count - 1}번: 본문 (핵심정보, 통계, 주의사항, 기회, 체크리스트 순으로, layout: bottom-left-list)
- ${count}번: 마무리/CTA (정리 + 팔로우 유도, layout: center)

규칙:
- 제목은 짧고 임팩트 있게 (최대 20자)
- 글머리 항목은 3~4개, 구체적 수치/사실 포함
- 한국어로 작성
- 강조색은 카테고리에 맞게: 부동산/세금→#FFD700, 건강/라이프→#4ADE80, 비즈니스→#60A5FA, 기타→#F97316
- 오버레이는 다크 계열로

JSON 배열만 응답하세요 (코드블록 없이):
[
  {
    "id": 1,
    "slideType": "cover",
    "layout": "center",
    "title": "제목",
    "subtitle": "부제목 (표지는 필수, 나머지는 '' 가능)",
    "imageKeyword": "Pexels 영어 검색 키워드 (다크/야경/도시 분위기 포함)",
    "overlay": "linear-gradient(to top, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.40) 100%)",
    "accent": "#FFD700",
    "bullets": [],
    "titleStyle": { "fontSize": 36, "fontWeight": "900", "color": "#FFFFFF" },
    "subtitleStyle": { "fontSize": 14, "fontWeight": "400", "color": "#CCCCCC" },
    "bulletStyle": { "fontSize": 14, "fontWeight": "400", "color": "#FFFFFF" }
  },
  {
    "id": 2,
    "slideType": "data",
    "layout": "bottom-left-list",
    "title": "슬라이드 제목",
    "subtitle": "",
    "imageKeyword": "...",
    "overlay": "linear-gradient(to top, rgba(0,0,0,0.90) 60%, rgba(0,0,0,0.30) 100%)",
    "accent": "#FFD700",
    "bullets": ["항목1", "항목2", "항목3"],
    "titleStyle": { "fontSize": 26, "fontWeight": "900", "color": "#FFD700" },
    "subtitleStyle": { "fontSize": 13, "fontWeight": "400", "color": "#CCCCCC" },
    "bulletStyle": { "fontSize": 14, "fontWeight": "400", "color": "#FFFFFF" }
  }
]`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const slides: any[] = JSON.parse(text);

    // Pexels 이미지 병렬 조회
    const images = await Promise.all(
      slides.map(s => fetchPexelsImage(s.imageKeyword || `dark city night ${category}`))
    );

    const pages = slides.map((s: any, i: number) => ({
      id: s.id || i + 1,
      bgImage: images[i],
      bgLabel: s.imageKeyword || keyword,
      overlay: s.overlay || 'linear-gradient(to top, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.40) 100%)',
      title: s.title || '제목',
      subtitle: s.subtitle || '',
      accent: s.accent || '#FFD700',
      layout: (['center', 'bottom-left', 'bottom-left-list'].includes(s.layout) ? s.layout : 'bottom-left-list') as 'center' | 'bottom-left' | 'bottom-left-list',
      bullets: Array.isArray(s.bullets) ? s.bullets : [],
      titleStyle: s.titleStyle || { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
      subtitleStyle: s.subtitleStyle || { fontSize: 13, fontWeight: '400', color: '#CCCCCC' },
      bulletStyle: s.bulletStyle || { fontSize: 14, fontWeight: '400', color: '#FFFFFF' },
      imageKeyword: s.imageKeyword || keyword,
      slideType: s.slideType || 'body',
    }));

    return NextResponse.json({ pages, keyword, category, slideCount: pages.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
