import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export async function POST(request: Request) {
  try {
    const { content, format = 'naver', tone } = await request.json();
    if (!content) return NextResponse.json({ error: 'content가 필요합니다' }, { status: 400 });

    const { data: persona } = await supabase.from('brand_personas').select('*').limit(1).maybeSingle();

    const personaContext = persona
      ? `[브랜드 페르소나] 브랜드: ${persona.brand_name}, 톤: ${tone || persona.tone}, 타겟: ${persona.target_audience}, 업종: ${persona.industry}`
      : tone ? `[톤] ${tone}` : '';

    const formatGuide: Record<string, string> = {
      naver: `네이버 블로그 스타일:
- 제목: 검색 최적화 키워드 포함 (20-30자)
- 소제목마다 ✅ 또는 📌 이모지 사용
- 중간중간 개행으로 가독성 확보
- 핵심 내용은 굵은 글씨 [**단어**] 표시
- 마무리에 "오늘 포스팅 어떠셨나요?" 류 소통 문구
- 해시태그 10-15개로 마무리`,
      tistory: `티스토리/워드프레스 스타일:
- 제목: SEO 최적화, 키워드 앞에 배치
- H2/H3 소제목 계층 구조 (## / ###)
- 목차 섹션 포함
- 리스트, 표 활용
- 5000자 이상, 전문적인 설명
- 마지막에 요약 박스`,
      instagram: `인스타그램 블로그 캡처용:
- 짧고 임팩트 있는 제목
- 핵심 포인트 3-5개로 압축
- 이모지 적극 활용
- 줄바꿈으로 읽기 편하게
- CTA(행동 유도) 문구로 마무리`,
    };

    const prompt = `다음 내용으로 블로그 글을 작성하세요.
${personaContext}

원본 내용:
${content}

${formatGuide[format] || formatGuide.naver}

2000자 이상 작성하고, 반드시 아래 JSON 형식으로만 응답하세요:
{
  "title": "SEO 최적화 제목",
  "body": "블로그 본문 전체 (마크다운 형식)",
  "metaDescription": "검색 결과에 표시될 설명 (150자 이내)",
  "tags": ["태그1", "태그2", "태그3"]
}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
