import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function fetchTextFromUrl(url: string, maxChars: number): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CardNewsBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    const cleaned = html
      .replace(/<(nav|header|footer)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.slice(0, maxChars);
  } catch (err) {
    return '';
  }
}

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
      personaId,
      category,
      sourceUrl,
    } = await request.json();

    let urlContent = '';
    if (sourceUrl) {
      urlContent = await fetchTextFromUrl(sourceUrl, 3000);
    }

    const validRefLinks = (refLinks || []).filter((l: string) => l.trim());
    const refContents = await Promise.allSettled(
      validRefLinks.map((url: string) => fetchTextFromUrl(url, 1200))
    );
    const validRefContents = refContents
      .map(r => r.status === 'fulfilled' ? r.value : '')
      .filter(Boolean);

    const refLinksSection = validRefContents.length > 0
      ? validRefContents.map((text, idx) => `[참고자료 ${idx + 1} 본문]\n${text}`).join('\n\n')
      : '';

    const mainInput = topic || content || (sourceUrl ? `[기사 URL 참고생성: ${sourceUrl}]` : '');
    if (!mainInput) return NextResponse.json({ error: '주제 또는 내용이 필요합니다' }, { status: 400 });

    let persona = null;
    if (personaId && personaId !== 'none') {
      const { data } = await supabase
        .from('brand_personas')
        .select('*')
        .eq('id', personaId)
        .maybeSingle();
      persona = data;
    }

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
- 중간중간 개행으로 가독성 확보
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
- 줄바꿈으로 읽기 편하게
- 강력한 CTA 문구로 마무리
- 해시태그 20-30개`,
    };

    const personaSection = persona
      ? `[브랜드 페르소나]
- 브랜드: ${persona.brand_name}
- 페르소나 이름: ${persona.persona_name || persona.brand_name}
- 타겟 독자: ${persona.target_audience || '일반 대중'}
- 업종: ${persona.industry || '미정'}
- 글의 톤/말투: ${persona.tone || '전문적인 말투'}
- 포스팅 목적: ${persona.posting_goal || '정보 제공 및 신뢰 구축'}
- 연관 키워드: ${Array.isArray(persona.keywords) ? persona.keywords.join(', ') : ''}
- 이모지 스타일: ${persona.emoji_style || '적절히 사용'}`
      : '';

    const extraSections = [
      category && `카테고리: ${category}`,
      targetAudience && `대상 독자: ${targetAudience}`,
      keywords.length > 0 && `반드시 포함할 검색 키워드: ${keywords.join(', ')}`,
      validRefLinks.length > 0 && validRefContents.length === 0 && `참고 링크 (내용 참고용, 직접 인용 금지): ${validRefLinks.join(', ')}`,
      instructions && `추가 지시사항: ${instructions}`,
      cta && `마지막에 CTA 포함 - 버튼 텍스트: "${cta.text}"${cta.url ? `, 링크: ${cta.url}` : ''}`,
    ].filter(Boolean).join('\n');

    const urlContentSection = urlContent
      ? `[참고 원문 기사 본문 (반드시 이 내용을 바탕으로 새로운 블로그 글을 작성하십시오)]\n${urlContent}`
      : '';

    let markdownAndEmojiInstruction = '';
    if (format === 'naver' || format === 'instagram') {
      markdownAndEmojiInstruction = `
[중요 - 마크다운 및 장식 이모지 사용 금지]
- 본문에 **볼드** 및 ##, ### 같은 마크다운 헤딩 기호를 절대 사용하지 마십시오. 강조는 기호가 아닌 일반 문장 서술을 통해 진행하십시오.
- 문단 앞이나 내용 강조를 위한 장식용 이모지(✅, 📌, 🎉, ⭐, 👉, ✨, 🔥, 📢, 📍, 🔔, 💡, 🚀, 👑 등)를 절대 사용하지 마십시오.
- 오직 줄바꿈과 공백만을 사용하여 단락을 구분하고 가독성을 확보하십시오.`;
    } else if (format === 'tistory') {
      markdownAndEmojiInstruction = `
[중요 - 장식 이모지 사용 금지]
- 소제목 구성을 위해 마크다운 헤딩(##, ###)과 볼드(**단어**) 문법은 사용하되, 장식용 이모지(✅, 📌, 🎉, ⭐, 👉, ✨, 🔥, 📢, 📍, 🔔, 💡, 🚀, 👑 등)는 일체 사용하지 마십시오.`;
    }

    const ctaInstruction = cta
      ? `- [필수 CTA] 글 마지막 마무리 단락에 다음 행동 유도(CTA)를 반드시 포함하여 독자의 행동을 유도하세요. 문구: "${cta.text}"${cta.url ? `, 링크: ${cta.url}` : ''}`
      : (persona 
          ? `- 글 마무리 시 브랜드(${persona.brand_name})와 부합하는 자연스러운 소통 멘트로 포스팅을 마치십시오.` 
          : `- 브랜드 멘트나 링크 없이 깔끔하게 일반적인 마무리 소통 문구로 포스팅을 마치십시오.`);

    const instructionsInstruction = instructions
      ? `\n[특별 추가 지시사항]\n- 다음 지시사항을 반드시 따르십시오: ${instructions}`
      : '';

    const prompt = `당신은 SEO 전문가이자 블로그 작가입니다.
${langInstruction[language] || langInstruction.auto}

${personaSection}

${urlContentSection}

[블로그 주제]
${mainInput}

${extraSections ? `[추가 설정]\n${extraSections}\n` : ''}
${refLinksSection ? `${refLinksSection}\n` : ''}
${formatGuide[format] || formatGuide.naver}

[작성 및 톤 지침]
${persona ? `- 글의 전반적인 말투와 분위기는 브랜드 페르소나의 '글의 톤/말투'(${persona.tone})를 적극 반영하여 통일성 있게 작성하세요.
- 타겟 독자(${targetAudience || persona.target_audience || '일반 대중'})의 관심사와 수준에 맞는 단어와 설명 방식을 선택하세요.
- 포스팅 목적(${persona.posting_goal || '정보 제공'})이 잘 달성되도록 유용한 내용 위주로 깊이 있게 글을 구성하세요.` : `- 글의 전반적인 말투와 분위기는 지정된 톤(${toneLabel[tone] || '전문적인'})에 맞게 구성하세요.
- 브랜드 언급이나 특정 페르소나 색채 없이 깔끔하고 객관적인 일반 글(정보성 콘텐츠) 형태로 작성하세요.`}
${ctaInstruction}
${markdownAndEmojiInstruction}${instructionsInstruction}

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

    const cleanContent = (text: string, fmt: string, isTitle = false): string => {
      if (!text) return text;

      // 1. 공통: 장식용/강조용 이모지 제거 (정규식 기반)
      const decorativeEmojisRegex = /[✅📌🎉⭐👉✨🔥📢📍🔔💡🚀🔍👑✔️✔🔵🟢🔴⚫⚪🔸🔹🔺🔻]/g;
      let cleaned = text.replace(decorativeEmojisRegex, '');

      // 2. 네이버/인스타그램 마크다운 제거
      if (fmt === 'naver' || fmt === 'instagram') {
        if (!isTitle) {
          // 행의 시작에 위치한 ## ### 등만 매칭하여 공백과 함께 기호만 제거 (해시태그 #태그 오인 제거 완벽 차단)
          cleaned = cleaned.replace(/^(#{1,6})\s+(.+)$/gm, '$2');
        }
        // 짝이 맞는 볼드 기호만 변환하여 단순 아스테리스크(곱셈 5*5 등) 오인 제거 차단
        cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
        cleaned = cleaned.replace(/__(.*?)__/g, '$1');
      }

      return cleaned;
    };

    try {
      const generatePromise = (async () => {
        // maxOutputTokens를 16384로 상향하여 출력 여유 공간 극대화
        let text = (await generateWithRetry(prompt, {
          generationConfig: { maxOutputTokens: 16384 }
        })).trim();
        const parsed = parseStructuredBlog(text);
        
        // 후처리 청소 적용
        parsed.title = cleanContent(parsed.title, format, true);
        parsed.body = cleanContent(parsed.body, format, false);
        parsed.metaDescription = cleanContent(parsed.metaDescription, format, false);
        
        return parsed;
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
