import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

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

[목표 분량]
- 본문 분량: ${wordCount}자 내외 (시간 초과 방지를 위해 1800자~2300자 사이로 엄수하십시오)

[응답 형식]
반드시 JSON 구조나 마크다운 코드블록 없이, 정확히 아래 지정된 대괄호 구분자 포맷으로만 작성하십시오:

[TITLE]
SEO 최적화 제목

[BODY]
블로그 본문 전체

[META]
검색 결과에 표시될 설명 (120자 이내)

[TAGS]
태그1, 태그2, 태그3, 태그4, 태그5`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 50000)
    );

    const parseStructuredBlog = (cleanText: string): { title: string; body: string; metaDescription: string; tags: string[] } => {
      const titleTag = '[TITLE]';
      const bodyTag = '[BODY]';
      const metaTag = '[META]';
      const tagsTag = '[TAGS]';

      const idxTitle = cleanText.indexOf(titleTag);
      const idxBody = cleanText.indexOf(bodyTag);
      const idxMeta = cleanText.indexOf(metaTag);
      const idxTags = cleanText.indexOf(tagsTag);

      const getSection = (currentTag: string, currentIdx: number): string => {
        if (currentIdx === -1) return '';
        const start = currentIdx + currentTag.length;
        const nextIndices = [idxTitle, idxBody, idxMeta, idxTags]
          .filter(idx => idx > currentIdx)
          .sort((a, b) => a - b);
        const end = nextIndices.length > 0 ? nextIndices[0] : cleanText.length;
        return cleanText.substring(start, end).trim();
      };

      let title = getSection(titleTag, idxTitle);
      let body = getSection(bodyTag, idxBody);
      let metaDescription = getSection(metaTag, idxMeta);
      const tagsText = getSection(tagsTag, idxTags);

      // 제목 복구
      if (!title && idxBody !== 0 && idxBody !== -1) {
        title = cleanText.substring(0, idxBody).replace(/^[#\s[\]\w]+/, '').split('\n')[0].trim();
      }

      // 본문 복구
      if (!body && idxTitle !== -1) {
        body = getSection(titleTag, idxTitle);
      } else if (!body && idxTitle === -1 && idxBody === -1) {
        body = cleanText;
      }

      // 메타 설명 복구 (잘렸거나 누락 시 본문 앞부분 발췌)
      if (!metaDescription) {
        const plainBody = body.replace(/[#*`_\-\[\]\(\)]/g, '').replace(/\s+/g, ' ').trim();
        metaDescription = plainBody.substring(0, 120) + '...';
      }

      // 태그 복구
      let tags: string[] = [];
      if (tagsText) {
        tags = tagsText
          .split(/[,#\s]+/)
          .map(t => t.trim())
          .filter(t => t.length > 0 && t.length < 15);
      }
      if (tags.length === 0) {
        tags = ['블로그', '정보', '포스팅'];
      }

      return {
        title: title || '블로그 포스팅',
        body: body || '본문을 생성하지 못했습니다. 다시 시도해 주세요.',
        metaDescription: metaDescription.substring(0, 150),
        tags: tags.slice(0, 8)
      };
    };

    try {
      const generatePromise = (async () => {
        // maxOutputTokens를 16384로 상향하여 출력 여유 공간 극대화
        let text = (await generateWithRetry(prompt, {
          generationConfig: { maxOutputTokens: 16384 }
        })).trim();
        return parseStructuredBlog(text);
      })();

      const data = await Promise.race([generatePromise, timeoutPromise]);
      return NextResponse.json(data);
    } catch (err: any) {
      if (err.message === 'TIMEOUT') {
        return NextResponse.json(
          { error: 'AI 생성 요청이 지연되어 시간 초과되었습니다. 잠시 후 다시 시도해주세요.' },
          { status: 504 }
        );
      }
      return NextResponse.json({ error: toKoreanError(err) }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
