import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const {
      topic,
      content,
      format = 'naver',
      tone = 'professional',
      language = 'auto',
      targetAudience,
      wordCount = 2000,
      keywords = [],
      refLinks = [],
      instructions,
      cta,
    } = await request.json();

    const mainInput = topic || content;
    if (!mainInput) return NextResponse.json({ error: '주제 또는 내용이 필요합니다' }, { status: 400 });

    const { data: persona } = await supabase.from('brand_personas').select('*').limit(1).maybeSingle();

    const toneLabel: Record<string, string> = {
      professional: '전문적이고 신뢰감 있는',
      friendly: '친근하고 따뜻한',
      trendy: '트렌디하고 젊은',
      emotional: '감성적이고 공감가는',
      informative: '정보 전달 중심의 명확한',
      persuasive: '설득력 있고 행동 유도하는',
    };

    const langInstruction: Record<string, string> = {
      auto: '입력된 주제의 언어에 맞게 작성하세요.',
      ko: '반드시 한국어로 작성하세요.',
      en: 'Write entirely in English.',
      ja: '日本語で書いてください。',
    };

    const formatGuide: Record<string, string> = {
      naver: `[네이버 블로그 스타일]
- 제목: 검색 최적화 키워드 포함 (20-35자)
- 소제목마다 ✅ 또는 📌 이모지 사용
- 중간중간 개행으로 가독성 확보
- 핵심 내용은 굵은 글씨 **단어** 표시
- 친근하고 대화하듯 마무리 소통 문구
- 해시태그 10-15개로 마무리`,
      tistory: `[티스토리/워드프레스 스타일]
- 제목: SEO 최적화, 핵심 키워드 앞에 배치
- 목차 섹션 (## 목차) 포함
- H2/H3 소제목 계층 구조 (## / ###) 사용
- 리스트, 표, 인용구 적극 활용
- 전문적인 설명과 근거 제시
- 마지막에 핵심 요약 박스`,
      instagram: `[인스타그램 캡처용 스타일]
- 짧고 임팩트 있는 제목
- 핵심 포인트 3-5개로 압축
- 이모지 적극 활용
- 줄바꿈으로 읽기 편하게
- 강력한 CTA 문구로 마무리
- 해시태그 20-30개`,
    };

    const personaSection = persona
      ? `[브랜드 페르소나] 브랜드: ${persona.brand_name}, 타겟: ${persona.target_audience}, 업종: ${persona.industry}`
      : '';

    const extraSections = [
      targetAudience && `대상 독자: ${targetAudience}`,
      keywords.length > 0 && `반드시 포함할 검색 키워드: ${keywords.join(', ')}`,
      refLinks.length > 0 && `참고 링크 (내용 참고용, 직접 인용 금지): ${refLinks.join(', ')}`,
      instructions && `추가 지시사항: ${instructions}`,
      cta && `마지막에 CTA 포함 - 버튼 텍스트: "${cta.text}"${cta.url ? `, 링크: ${cta.url}` : ''}`,
    ].filter(Boolean).join('\n');

    const prompt = `당신은 SEO 전문가이자 ${toneLabel[tone] || '전문적인'} 블로그 작가입니다.
${langInstruction[language] || langInstruction.auto}

${personaSection}

[블로그 주제]
${mainInput}

${extraSections ? `[추가 설정]\n${extraSections}\n` : ''}
${formatGuide[format] || formatGuide.naver}

목표 분량: ${wordCount}자 이상

반드시 아래 JSON 형식으로만 응답하세요 (코드블록 없이):
{
  "title": "SEO 최적화 제목",
  "body": "블로그 본문 전체",
  "metaDescription": "검색 결과에 표시될 설명 (150자 이내)",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"]
}`;

    let text = (await generateWithRetry(prompt)).trim();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
