import { generateWithRetry, callWithFallback, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';
import { getSite, factsBlock, unknownNumbers } from '@/lib/sites/siteFacts';

export async function POST(request: Request) {
  try {
    const { input, category, recency, siteSlug } = await request.json().catch(() => ({}));

    if (!input && !category && !siteSlug) {
      return NextResponse.json({ error: 'input 또는 category 필요' }, { status: 400 });
    }


    // 현장을 고르면 승인 자료에만 근거해 주제를 뽑는다 (자료에 없는 숫자·혜택 금지)
    if (siteSlug) {
      const site = await getSite(String(siteSlug));
      if (!site) return NextResponse.json({ error: '근거 자료가 없는 현장입니다.' }, { status: 404 });
      const gp = `당신은 부동산 분양 SNS 카드뉴스 기획자입니다. 아래 [현장 근거]에 적힌 사실만으로 카드뉴스 주제 6개를 제안하세요.
${factsBlock(site)}

[지침]
1. 근거에 없는 숫자·할인·혜택·입지 정보를 절대 만들지 않는다. 숫자는 근거에 적힌 그대로만 쓴다.
2. 서로 다른 각도로 (교통 / 규모·브랜드 / 생활 인프라 / 계약조건 / 자금계획 / 실수요자 질문 등).
3. 카드뉴스 표지 제목처럼 구체적이고 이목을 끄는 한 줄.${input ? `
4. 추가 요청: ${input}` : ''}
4. JSON 배열(문자열 6개)로만 응답.`;
      let g = await callWithFallback({ prompt: gp, model: 'anthropic/claude-haiku-4.5', maxTokens: 4000, json: true });
      g = g.includes('```') ? g.split('```')[1].replace(/^json/, '').trim() : g.trim();
      const all: string[] = JSON.parse(g);
      const topics = all.filter(t => unknownNumbers(t, site).length === 0);
      return NextResponse.json({ topics, dropped: all.length - topics.length });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' });

    let recencyInstruction = '';
    if (recency === 'today') {
      recencyInstruction = `\n- 기준 날짜: 오늘은 ${dateStr}입니다. 오늘~최근 2~3일 내 실시간 이슈/뉴스 위주의 주제로.`;
    } else if (recency === 'week') {
      recencyInstruction = `\n- 기준 날짜: 오늘은 ${dateStr}입니다. 최근 1주일 내 화제가 된 트렌드 위주의 주제로.`;
    } else if (recency === 'month') {
      recencyInstruction = `\n- 기준 날짜: 오늘은 ${dateStr}입니다. 최근 한 달 내 흐름·이슈 위주의 주제로.`;
    }

    const prompt = `당신은 프로페셔널한 한국 SNS 카드뉴스 기획자입니다.
제공된 입력 정보와 카테고리를 반영하여, 2026년 현재 인스타그램, 네이버 등 SNS에서 대중의 큰 관심을 받을 만한 "구체적이고 매력적인 카드뉴스 주제 후보 6개"를 추천해주세요.

[정보]
- 자유 입력 서두: ${input || '제공되지 않음'}
- 카테고리: ${category || '제공되지 않음'}${recencyInstruction}

[지침]
1. 시의성 및 최신성 극대화: 오래되거나 유행이 지난 주제는 제외하고, 2026년 현재 트렌드와 시의성에 알맞은 최신 주제로 구성하세요. 날짜가 지난 이슈나 과거 데이터는 배제합니다.
2. 구체적인 제목 형태: 단순한 키워드가 아니라, 카드뉴스 표지 제목처럼 한눈에 이목을 끄는 구체적인 제목으로 지어주세요. (예: "2026년 3기 신도시 청약 일정 총정리", "기획자가 반드시 알아야 할 이번 주 숏폼 트렌드")
3. 응답 포맷: 다른 설명이나 인사말 없이 오직 JSON 배열 형태로만 응답하세요.

예시 응답:
["주제1", "주제2", "주제3", "주제4", "주제5", "주제6"]`;

    let text = await generateWithRetry(prompt);

    if (text.includes('```json')) {
      text = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      text = text.split('```')[1].split('```')[0].trim();
    } else {
      text = text.trim();
    }

    const topics = JSON.parse(text);
    if (!Array.isArray(topics)) {
      throw new Error("AI 응답이 배열 형식이 아닙니다.");
    }

    return NextResponse.json({ topics });
  } catch (error: any) {
    console.error('[topic-suggest] 에러:', error);
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
