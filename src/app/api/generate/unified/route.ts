import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { callAI } from '@/lib/ai/openrouter';
import { extractArticle } from '@/lib/extractArticle';
import { normalizeHeadlines } from '@/lib/cardnews/normalizeHeadline';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url, originalText, templateTitle, slideCount, ratio, genStyle, extraInstruction, outputLanguage } = await request.json();

    let inputContent = originalText || '';
    let sourceMode: 'url' | 'text' = originalText ? 'text' : 'url';

    if (url && !originalText) {
      try {
        // 예전에는 HTML 태그만 지우고 앞 3000자를 썼는데, 그 구간이 대부분
        // 네비게이션 메뉴·광고라서 기사와 전혀 다른 카드뉴스가 나왔다.
        const article = await extractArticle(url);
        inputContent = article.text;
      } catch (e: any) {
        // 못 읽었으면 지어내지 말고 실패시킨다 (예전엔 URL 문자열만으로 생성했다)
        return NextResponse.json(
          { error: e?.message || '해당 주소에서 본문을 읽지 못했습니다.' },
          { status: 422 }
        );
      }
    }

    if (!inputContent) {
      return NextResponse.json({ error: 'Input (URL or text) is required' }, { status: 400 });
    }

    const slideInstruction =
      (!slideCount || slideCount === 'auto')
        ? '카드뉴스는 내용에 맞춰 4~7장 사이로 적절히 생성할 것'
        : `카드뉴스는 정확히 ${slideCount}장으로 생성할 것`;

    let genStyleInstruction = '';
    if (genStyle === 'origin') {
      genStyleInstruction = `\n- 스타일 지침: 원본 유지 스타일입니다. 템플릿의 고유한 색상 배합과 레이아웃 구조를 최대한 그대로 재사용하여 브랜딩의 통일성을 기하세요.`;
    } else if (genStyle === 'free') {
      genStyleInstruction = `\n- 스타일 지침: 자유 변형 스타일입니다. 템플릿의 분위기를 일부 참고하되, 생성된 콘텐츠의 개별 맥락과 내용적 필요에 따라 AI가 창의적이고 자유롭게 레이아웃 및 디자인 요소를 다채롭게 구성해 꾸미도록 지시하세요.`;
    }

    // URL에서 가져온 기사는 그 기사 내용만 쓰도록 못 박는다.
    // (원문에 없는 이야기로 새로 쓰는 바람에 "전혀 다른 내용"이 나오던 문제)
    const sourceFidelityBlock =
      sourceMode === 'url'
        ? `\n    [원문 충실도 — 매우 중요]
    - 아래 "내용"은 사용자가 지정한 기사 원문입니다. 이 기사에 실제로 담긴 사실만 사용하세요.
    - 기사에 없는 수치·지역·단지명·일정·가격을 새로 지어내지 마세요.
    - 기사의 주제를 다른 주제로 바꾸지 마세요. 카드뉴스 전체가 이 기사 한 건을 설명해야 합니다.
    - 기사에서 확인되지 않는 내용은 아예 쓰지 말고, 대신 기사에 있는 다른 사실로 채우세요.`
        : '';

    // 출력 언어: 'auto'거나 값이 없으면 입력 언어를 그대로 따른다
    const languageInstruction = outputLanguage
      ? `\n    [출력 언어]\n    - 카드뉴스 문구, 블로그, 바이럴 훅 등 모든 사용자 노출 텍스트를 ${outputLanguage}로 작성할 것. (imageKeyword는 예외 — 항상 영어)`
      : '';

    // 사용자가 직접 적어 넣은 추가 지시. 위 규칙과 충돌하면 이쪽을 우선한다.
    const extraInstructionBlock = extraInstruction
      ? `\n    [사용자 추가 지시사항 — 위 지침과 충돌하면 이쪽을 우선할 것]\n    ${String(extraInstruction).slice(0, 1000)}`
      : '';

    const prompt = `당신은 프로페셔널한 SNS 마케터이자 전문 카피라이터입니다.
    제공된 내용을 바탕으로 카드뉴스, 블로그 포스팅, 바이럴 후킹 문구를 생성하세요.
    사용자가 선택한 템플릿 스타일(${templateTitle || '일반'})을 고려하여 톤앤매너와 이미지 키워드를 결정하세요.${genStyleInstruction}

    반드시 아래 JSON 구조로 응답하세요:
    {
      "cardNews": [
        { 
          "page": 1, 
          "title": "대표제목 (폴백용)", 
          "subtitle": "보조설명 (폴백용)",
          "body": "본문 요약 텍스트 (폴백용)", 
          "imageKeyword": "영어 키워드",
          "brandTone": "gold",
          "showFrame": true,
          "layout": "bottom-left-list",
          "blocks": [
            { "type": "eyebrow", "text": "HOT ISSUE" },
            { "type": "headline", "text": "핵심 제목", "accentText": "강조어" },
            { "type": "badgeRow", "badges": [{ "text": "핵심 정보", "tone": "gold" }] }
          ]
        }
      ],
      "blogPost": "마크다운 문자열",
      "viralHooks": ["훅1", "훅2", "훅3"],
      "themeKey": "테마 키 문자열"
    }

    [지침]
    1. cardNews: ${slideInstruction}.
    2. blogPost: 마크다운 형식을 지키되, 줄바꿈은 \\n으로 처리하여 JSON 형식을 깨뜨리지 말 것. 블로그 본문은 공백 포함 800자 이내로 핵심만 간결하게 작성할 것 (상세한 긴 글은 불필요, 카드뉴스 요점 위주).
    3. imageKeyword: Unsplash/Pexels 검색용 영어 키워드. 템플릿 스타일 '${templateTitle}' 반영.
    4. themeKey: 생성한 콘텐츠의 주제와 톤앤매너에 가장 잘 어울리는 스타일 테마 키를 'business', 'cafe', 'lifestyle', 'travel', 'fashion', 'food', 'education' 중 정확히 1개 골라 소문자로 작성할 것. 주제가 모호하거나 적절한 매칭이 어려운 경우 기본값으로 'business'를 선택할 것.

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
    - { "type":"badgeRow", "badges":[{"text":"핵심 정보","tone":"gold"}] }  // tone: gold|green|neutral
    - { "type":"sourceNote", "text":"출처: ..." }

    [슬라이드 유형별 권장 블록 구성]
    - 표지(1번): eyebrow + headline(accentText 활용) + badgeRow
    - 가격/비용/수치: eyebrow("PRICE") + headline + compareTable (가장 중요한 행은 highlight:true)
    - 입지/위치/개요: eyebrow("LOCATION") + headline + badgeRow + (필요시 checklist)
    - 일정/절차: eyebrow("SCHEDULE") + headline + timeline (지난 단계 done, 임박 단계 active, 이후 todo)
    - 시세/통계/숫자: eyebrow + headline + statGrid(cols 2~4)
    - 정책/주의사항/체크리스트: eyebrow + headline + checklist
    - 마무리/CTA(마지막): eyebrow + headline + sub + sourceNote

    [blocks 생성 필수 규칙]
    - 각 카드의 blocks 배열은 절대로 비워두지 말고(빈 배열 금지) 반드시 1개 이상의 유효한 블록들로 풍부하게 작성하세요.
    - blocks의 필수 구조: 맨 앞 eyebrow 1개 + headline 1개 + 내용 블록 1개 이상 (compareTable, timeline, statGrid, checklist, badgeRow, sub 중 맥락에 맞게 선택).
    - eyebrow는 blocks 배열 맨 앞에 정확히 1개만 배치할 것.
    - 모든 슬라이드의 headline은 공백 포함 18자 이내로 작성할 것 (표지 포함). 18자를 넘으면 핵심만 남기고 줄여서 다시 쓸 것. 서술형 문장이 아니라 짧은 구/명사형으로 끝낼 것 (나쁜 예: "투자자들이 주목하는 이유는 무엇일까요" / 좋은 예: "투자자가 주목하는 이유").
    - accentText는 headline 안에서 강조할 3~6자 정도의 짧은 조각만 지정할 것.
    - sub(부제) 텍스트는 공백 포함 40자 이내로 작성할 것.
    - checklist 각 항목은 공백 포함 22자 이내의 짧은 구로 작성할 것 (긴 문장을 한 항목에 넣지 말고, 필요하면 항목을 나눌 것).
    - 수치는 구체적 숫자/단위로 작성할 것.
    - 주제가 비즈니스/부동산/세금/금융이면 brandTone "gold", 라이프/여행/패션/건강이면 "sage".
    - 모든 카드의 showFrame은 true.
    - layout은 'center', 'bottom-left', 'bottom-left-list' 중 설정.
    - blocks가 있어도 body 및 subtitle 필드는 비우지 말고 기존처럼 요약 텍스트를 반드시 채울 것 (폴백 보존용).
${sourceFidelityBlock}${languageInstruction}${extraInstructionBlock}
내용: ${inputContent}`;

    // let text = await generateWithRetry(prompt);
    let text = await callAI({
      prompt,
      model: 'anthropic/claude-haiku-4.5',
      maxTokens: 8000,
    });

    try {
      if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
      else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();
      const data = JSON.parse(text);
      // 강조어가 제목에 이미 들어 있으면 카드에 두 번 찍힌다.
      // BlockRenderer가 text 뒤에 accentText를 이어붙이는 구조라
      // "수도권 청약, 지금부터 준비하세요" + "지금부터" → "…준비하세요 지금부터"가 됐다.
      // 사진 스타일·노트 스타일 양쪽에 똑같이 나타나므로 여기서 한 번에 거른다.
      if (Array.isArray(data?.cardNews)) {
        data.cardNews = data.cardNews.map((c: any) =>
          Array.isArray(c?.blocks) ? { ...c, blocks: normalizeHeadlines(c.blocks) } : c
        );
      }
      return NextResponse.json(data);
    } catch {
      console.error('[unified] JSON 파싱 실패. 원본 응답:', text);
      return NextResponse.json({
        error: 'AI 응답 데이터 형식이 올바르지 않습니다. 다시 시도해 주세요.',
        raw: text.slice(0, 100),
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[unified] 생성 실패 원본 에러:', error);
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
