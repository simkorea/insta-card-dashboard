import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';
import type { SlideBlock, BrandTone } from '@/lib/cardnews/blocks';
import { createSupabaseServer } from '@/lib/supabase-server';

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
    const { keyword, category = '일반', slideCount = 7, personaId } = await request.json();
    if (!keyword) return NextResponse.json({ error: '키워드가 필요합니다' }, { status: 400 });

    const count = Math.min(Math.max(Number(slideCount) || 7, 5), 10);

    // 1. Fetch user brand persona from Supabase securely
    let brandName = '@aptshowhome';
    let brandTonePreference = 'professional';
    let targetAudience = '일반 대중';
    let brandKeywords: string[] = [];
    let emojiStyle = 'moderate';

    try {
      const supabase = await createSupabaseServer();
      let query = supabase.from('brand_personas').select('*');

      if (personaId) {
        query = query.eq('id', personaId);
      } else {
        query = query.limit(1);
      }

      const { data: persona } = await query.maybeSingle();

      if (persona) {
        if (persona.brand_name) brandName = persona.brand_name;
        if (persona.tone) brandTonePreference = persona.tone;
        if (persona.target_audience) targetAudience = persona.target_audience;
        if (persona.keywords && Array.isArray(persona.keywords)) brandKeywords = persona.keywords;
        if (persona.emoji_style) emojiStyle = persona.emoji_style;
      }
    } catch (dbError) {
      console.warn('[smart-cardnews API] Supabase brand_personas fetch bypassed or failed:', dbError);
      // Fallback seamlessly to default values
    }

    // Map tone preference to actual Korean descriptions for Gemini prompt
    const toneMap: Record<string, string> = {
      friendly: '친근하고 따뜻하며 편안한 말투',
      professional: '신뢰감 있고 정확하며 전문적인 말투',
      trendy: '트렌디하고 Z세대 감성이 묻어나는 재치 있는 말투',
      emotional: '공감과 깊은 울림을 주는 감성적인 말투',
      humorous: '재치 있고 웃음을 자아내는 유머러스한 말투',
      authoritative: '신뢰성과 무게감이 느껴지는 권위 있는 전문가 말투',
    };
    const toneDescription = toneMap[brandTonePreference] || '신뢰감 있고 전문적인 말투';

    // Map emoji style to instructions
    const emojiMap: Record<string, string> = {
      lots: '이모지를 아주 풍부하고 다양하게 배치하여 개성 있게 표현하세요.',
      moderate: '이모지를 주요 포인트에만 적당히 강조용으로 사용하세요.',
      none: '이모지를 절대 사용하지 말고 격식 있는 텍스트 위주로 기획하세요.',
    };
    const emojiInstruction = emojiMap[emojiStyle] || '이모지를 적당히 사용하세요.';

    const prompt = `당신은 인스타그램 카드뉴스 전문 콘텐츠 기획자입니다.
카테고리: ${category}
주제: ${keyword}

[브랜드 페르소나 및 지시사항]
- 주 타겟층: ${targetAudience}
- 톤앤매너: ${toneDescription}
- 스타일 가이드: ${emojiInstruction}
${brandKeywords.length > 0 ? `- 브랜드 핵심 키워드 (작성 시 내용 흐름상 자연스럽게 녹여내세요): ${brandKeywords.map(k => `#${k}`).join(', ')}` : ''}

다음 구조로 ${count}장의 카드뉴스를 기획하세요:
- 1번: 표지 (강렬한 후킹 제목)
- 2번~${count - 1}번: 본문 (주요 정보 전달)
- ${count}번: 마무리/CTA (정리 + 팔로우 유도)

[블록 타입 정의]
SlideBlock 종류:
- { "type":"eyebrow", "text": "섹션 라벨 (영문 대문자 권장: PRICE, LOCATION, SCHEDULE 등)" }
- { "type":"headline", "text":"메인 제목", "accentText":"강조할 일부(선택)" }
- { "type":"sub", "text":"보조 설명" }
- { "type":"bigNumber", "value":"7억대", "caption":"설명(선택)" }
- { "type":"statGrid", "cols":3, "items":[{"value":"39%","label":"민간 대비 저렴"}] }
- { "type":"compareTable", "rows":[{"label":"84㎡","value":"7억 3,245만원","highlight":true}] }
- { "type":"timeline", "items":[{"date":"2026.6.12","title":"당첨자 발표","desc":"설명(선택)","state":"active"}] }  // state: done|active|todo
- { "type":"checklist", "items":["항목1","항목2"] }
- { "type":"badgeRow", "badges":[{"text":"3기 신도시","tone":"gold"}] }  // tone: gold|green|neutral
- { "type":"sourceNote", "text":"출처: ..." }

[슬라이드 유형별 권장 블록 구성 — 부동산 기준]
- 표지(1번): eyebrow + headline(accentText 활용) + badgeRow
- 가격/분양가: eyebrow("PRICE") + headline + compareTable (가장 중요한 행은 highlight:true)
- 입지/위치: eyebrow("LOCATION") + headline + badgeRow + (필요시 timeline 대신 checklist)
- 일정/청약: eyebrow("SCHEDULE") + headline + timeline (지난 단계 done, 임박 단계 active, 이후 todo)
- 시세/통계/숫자: eyebrow + headline + statGrid(cols 2~4)
- 정책/주의사항/체크리스트: eyebrow + headline + checklist
- 마무리/CTA(마지막): eyebrow + headline + sub + sourceNote
- 출처가 있는 슬라이드(가격/일정/통계)에는 sourceNote를 끝에 권장.

규칙:
- 카테고리가 부동산/세금/금융이면 brandTone "gold", 라이프/건강/웰니스면 "sage".
- 모든 슬라이드 showFrame: true.
- value/label은 구체적 수치로. 표지 headline은 짧고 강하게(최대 20자).
- blocks 배열 안에서 eyebrow는 맨 앞 1개만.
- JSON.parse가 가능한 순수 JSON 배열 형태로만 출력해야 합니다. 코드 블록(예: \`\`\`json)은 제외하고 오직 JSON 데이터만 출력하세요.

[마무리/CTA 지시사항 - 초중요]
- ${count}번 마무리 카드의 본문(headline, sub 등)에는 반드시 계정명 '${brandName}'을(를) 팔로우하도록 강력하고 친근하게 유도하는 문구를 담으세요.
- 절대로 다른 가상의 계정이나 임의로 지어낸 가짜 핸들(예: @부동산_인사이트, @apt_info 등)을 창작해서 대입하지 마세요. 본문에 등장할 수 있는 유일한 인스타그램 계정명은 오직 '${brandName}'뿐입니다.

[출력 JSON 형식]
[
  {
    "id": 1,
    "imageKeyword": "Pexels 영어 검색 키워드 (다크/도시/건물 분위기 포함)",
    "overlay": "linear-gradient(to top, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.35) 100%)",
    "brandTone": "gold",
    "showFrame": true,
    "layout": "center",
    "title": "대표제목 (폴백용)",
    "subtitle": "부제목 (폴백용)",
    "bullets": [],
    "blocks": [
      { "type": "eyebrow", "text": "HOT PLACE" },
      { "type": "headline", "text": "왕숙 아테라 분양", "accentText": "7억대" },
      { "type": "badgeRow", "badges": [{ "text": "3기 신도시", "tone": "gold" }] }
    ]
  }
]`;

    let text = (await generateWithRetry(prompt)).trim();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const slides: any[] = JSON.parse(text);

    // Pexels 이미지 병렬 조회
    const images = await Promise.all(
      slides.map(s => fetchPexelsImage(s.imageKeyword || `dark city night ${category}`))
    );

    // 2. Post-processing safety guard: scan and clean any fake @handles in the blocks
    const handleRegex = /@[가-힣A-Za-z0-9_]+/g;

    const pages = slides.map((s: any, i: number) => {
      let finalBlocks: SlideBlock[] = Array.isArray(s.blocks) ? s.blocks : [];
      if (finalBlocks.length === 0) {
        finalBlocks = [{ type: 'headline', text: s.title || '제목' }];
      }

      // Safe Regex Substitution to override any hallucinated handles in slide blocks
      finalBlocks = finalBlocks.map((block) => {
        const nextBlock = { ...block };
        if ('text' in nextBlock && nextBlock.text) {
          nextBlock.text = nextBlock.text.replace(handleRegex, () => brandName);
        }
        if ('accentText' in nextBlock && nextBlock.accentText) {
          nextBlock.accentText = nextBlock.accentText.replace(handleRegex, () => brandName);
        }
        if ('caption' in nextBlock && nextBlock.caption) {
          nextBlock.caption = nextBlock.caption.replace(handleRegex, () => brandName);
        }
        return nextBlock;
      });

      return {
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
        
        // blocks 시스템 필드
        blocks: finalBlocks,
        brandTone: (s.brandTone === 'sage' ? 'sage' : 'gold') as BrandTone,
        showFrame: s.showFrame !== false,
        blocksOffsetY: i === 0 ? 78 : 90,
        handle: brandName, // Bind correct dynamic handle to every generated card
      };
    });

    return NextResponse.json({ pages, keyword, category, slideCount: pages.length });
  } catch (e: any) {
    return NextResponse.json({ error: toKoreanError(e) }, { status: 500 });
  }
}
