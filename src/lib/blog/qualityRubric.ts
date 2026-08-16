// 블로그 원고 품질 채점 루브릭.
//
// 3축 19영역 59항목. 기준만 여기서 손보면 되도록 라우트와 분리했다.
//
// 축의 뜻:
//   SEO — 검색 결과에서 발견되고 선택될 가능성
//   AEO — 사용자의 질문에 직접 답할 가능성
//   GEO — AI 답변의 근거·출처로 인용될 가능성
//
// ⚠️ 이 항목들은 네이버가 공개한 공식 기준이 아니다. 일반적인 검색·인용
// 최적화 원칙을 옮긴 것이므로, 쓰면서 계속 손봐야 한다. 기준을 바꾸면
// RUBRIC_VERSION 을 올려라 — 안 그러면 나중에 점수가 움직였을 때 원고가
// 좋아진 건지 기준이 바뀐 건지 구분할 수 없다.
//
// 항목에 measure 가 있으면 코드가 직접 센다(=항상 같은 값). 없으면 AI가
// 판단한다. 셀 수 있는 것을 AI에게 맡기지 않는 이유는 재현성 때문이다.

export const RUBRIC_VERSION = '2026-08-16.1';

/** 채점 대상 원고 */
export type QualityDoc = {
  title: string;
  body: string;
  tags: string[];
  /** 목표 검색어. 비면 라우트가 본문에서 추정해 채운다 */
  targetKeyword: string;
  /** 이미지 슬롯 (url 이 있는 것만 셈) */
  images: { url?: string; label?: string }[];
};

export type RubricItem = {
  id: string;
  label: string;
  /** AI에게 주는 판정 기준. 반드시 수치로 쓸 것 */
  criteria: string;
  /** 있으면 코드가 0~5점을 직접 계산한다 */
  measure?: (d: QualityDoc, m: Metrics) => { score: number; why: string };
};

export type RubricArea = { id: string; label: string; items: RubricItem[] };
export type RubricAxis = { id: 'seo' | 'aeo' | 'geo'; label: string; desc: string; areas: RubricArea[] };

// ── 본문에서 한 번만 뽑아 두는 값들 ──────────────────────────────────────
export type Metrics = ReturnType<typeof measureDoc>;

export function measureDoc(d: QualityDoc) {
  const body = d.body || '';
  const lines = body.split('\n').map(l => l.trim());
  const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  // 소제목: 마크다운 헤딩이거나, 짧고 마침표로 안 끝나는 단독 줄
  const headings = lines.filter(l =>
    /^#{1,6}\s+\S/.test(l) || (l.length > 0 && l.length <= 30 && !/[.!?]$/.test(l) && !l.startsWith('#') && !/^[-*·]/.test(l))
  );

  // 문장 (한국어 종결 기준)
  const sentences = body
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+|(?<=습니다|입니다|합니다|됩니다|칩니다)\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 4);

  // 인용 가능한 수치: 숫자 + 단위/기호
  const numeric = body.match(/\d[\d,.]*\s*(%|원|만원|억|년|개월|일|명|건|㎡|평|층|배|위|회|가구|세대|점)/g) || [];
  const bareYears = body.match(/\b20\d{2}\b/g) || [];

  // 질문형 문장·소제목
  const questions = lines.filter(l => /[?？]\s*$/.test(l) || /(무엇|어떻게|왜|언제|어디|누가|얼마|인가요|할까요|되나요|가요)\s*[?？]?$/.test(l));

  // 목록
  const bullets = lines.filter(l => /^([-*·•]|\d+[.)])\s+\S/.test(l));

  const imagesWithUrl = (d.images || []).filter(i => i?.url);
  const imagesWithLabel = imagesWithUrl.filter(i => (i.label || '').trim().length >= 2);

  const kw = (d.targetKeyword || '').trim();
  const head300 = body.slice(0, 300);

  return {
    charCount: body.replace(/\s/g, '').length,
    charCountWithSpaces: body.length,
    titleLen: (d.title || '').length,
    paragraphs,
    longParagraphs: paragraphs.filter(p => p.length > 400).length,
    headings,
    headingCount: headings.length,
    sentences,
    longSentences: sentences.filter(s => s.length > 120).length,
    numericCount: numeric.length + bareYears.length,
    questionCount: questions.length,
    bulletCount: bullets.length,
    tagCount: (d.tags || []).length,
    imageCount: imagesWithUrl.length,
    imageLabeled: imagesWithLabel.length,
    keyword: kw,
    keywordInTitle: kw ? (d.title || '').includes(kw) : false,
    keywordInHead300: kw ? head300.includes(kw) : false,
    keywordCount: kw ? (body.split(kw).length - 1) : 0,
    /** 키워드 밀도(%) — 과최적화 판정용 */
    keywordDensity: kw && body.length ? ((kw.length * (body.split(kw).length - 1)) / body.length) * 100 : 0,
  };
}

// 점수 구간 헬퍼: [기준값, 점수] 를 큰 순서로 주면 해당 구간 점수를 준다
const band = (v: number, tiers: [number, number][], fmt: (v: number) => string) => {
  for (const [min, score] of tiers) if (v >= min) return { score, why: fmt(v) };
  return { score: 0, why: fmt(v) };
};

// ── SEO ────────────────────────────────────────────────────────────────
const SEO: RubricArea[] = [
  {
    id: 'intent', label: '검색의도 적합도',
    items: [
      { id: 'seo_intent_match', label: '검색의도 충족', criteria: '목표 검색어로 검색한 사람이 알고 싶은 것에 본문이 직접 답하면 5, 부분적이면 3, 겉돌면 1, 무관하면 0' },
      { id: 'seo_intent_scope', label: '주제 범위', criteria: '한 글이 하나의 검색의도에 집중하면 5, 두 가지가 섞이면 3, 산만하면 1' },
      { id: 'seo_intent_depth', label: '의도별 깊이', criteria: '검색자가 이어서 궁금해할 후속 질문까지 다루면 5, 기본만 다루면 3, 표면적이면 1' },
    ],
  },
  {
    id: 'title', label: '제목·주제 일치',
    items: [
      {
        id: 'seo_title_keyword', label: '제목에 목표 검색어',
        criteria: '제목에 목표 검색어가 그대로 있으면 5, 유사어만 있으면 3, 없으면 0',
        measure: (_d, m) => m.keyword
          ? (m.keywordInTitle ? { score: 5, why: `제목에 "${m.keyword}" 포함` } : { score: 0, why: `제목에 "${m.keyword}" 없음` })
          : { score: 3, why: '목표 검색어 미지정' },
      },
      {
        id: 'seo_title_len', label: '제목 길이',
        criteria: '20~35자 5점, 15~19자 또는 36~45자 3점, 그 밖 1점',
        measure: (_d, m) => {
          const n = m.titleLen;
          if (n >= 20 && n <= 35) return { score: 5, why: `${n}자 (권장 20~35자)` };
          if ((n >= 15 && n < 20) || (n > 35 && n <= 45)) return { score: 3, why: `${n}자 (권장 20~35자)` };
          return { score: 1, why: `${n}자 — 권장 20~35자에서 벗어남` };
        },
      },
      { id: 'seo_title_promise', label: '제목-본문 약속 일치', criteria: '제목이 약속한 내용을 본문이 모두 다루면 5, 일부만 다루면 3, 제목이 과장이면 0' },
    ],
  },
  {
    id: 'substance', label: '정보 충실도',
    items: [
      {
        id: 'seo_len', label: '본문 분량',
        criteria: '공백 제외 1500자 이상 5, 1000~1499자 4, 700~999자 3, 400~699자 2, 400자 미만 1',
        measure: (_d, m) => band(m.charCount, [[1500, 5], [1000, 4], [700, 3], [400, 2]], v => `공백 제외 ${v}자`),
      },
      { id: 'seo_coverage', label: '하위 주제 커버리지', criteria: '주제의 핵심 하위 주제를 5개 이상 다루면 5, 3~4개 3, 1~2개 1' },
      { id: 'seo_actionable', label: '실행 가능한 정보', criteria: '독자가 바로 따라 할 수 있는 구체적 절차·기준이 3개 이상이면 5, 1~2개 3, 없으면 1' },
      { id: 'seo_no_filler', label: '군더더기 없음', criteria: '내용 없는 수사·반복이 거의 없으면 5, 일부 있으면 3, 절반 이상이 채우기용이면 1' },
    ],
  },
  {
    id: 'originality', label: '독창성·경험정보',
    items: [
      { id: 'seo_experience', label: '직접 경험·현장 정보', criteria: '직접 보고 겪은 서술이 3곳 이상이면 5, 1~2곳 3, 전혀 없으면 1' },
      { id: 'seo_unique_view', label: '독자적 해석', criteria: '사실 나열을 넘어 필자의 판단·해석이 있으면 5, 약간 있으면 3, 요약뿐이면 1' },
      { id: 'seo_not_generic', label: '일반론 탈피', criteria: '어디서나 볼 수 있는 일반론이 아니라 이 주제에만 해당하는 내용이면 5, 절반쯤이면 3, 대부분 일반론이면 1' },
    ],
  },
  {
    id: 'structure', label: '구조·가독성',
    items: [
      {
        id: 'seo_headings', label: '소제목 개수',
        criteria: '소제목 4개 이상 5, 3개 4, 2개 3, 1개 2, 0개 0',
        measure: (_d, m) => band(m.headingCount, [[4, 5], [3, 4], [2, 3], [1, 2]], v => `소제목 ${v}개`),
      },
      {
        id: 'seo_para_len', label: '문단 길이',
        criteria: '400자 넘는 문단이 0개면 5, 1개 3, 2개 2, 3개 이상 1',
        measure: (_d, m) => band(-m.longParagraphs, [[0, 5], [-1, 3], [-2, 2]], () => `400자 초과 문단 ${m.longParagraphs}개`),
      },
      {
        id: 'seo_sentence_len', label: '문장 길이',
        criteria: '120자 넘는 문장이 0개면 5, 1~2개 3, 3개 이상 1',
        measure: (_d, m) => band(-m.longSentences, [[0, 5], [-2, 3]], () => `120자 초과 문장 ${m.longSentences}개`),
      },
      {
        id: 'seo_list_use', label: '목록·나열 활용',
        criteria: '목록 항목이 3개 이상이면 5, 1~2개 3, 없으면 2',
        measure: (_d, m) => band(m.bulletCount, [[3, 5], [1, 3]], v => `목록 항목 ${v}개`),
      },
    ],
  },
  {
    id: 'freshness', label: '최신성',
    items: [
      { id: 'seo_recency', label: '최신 정보 반영', criteria: '올해 기준 정보가 명시되면 5, 연도 표기 없이 최신으로 보이면 3, 낡은 정보면 1' },
      { id: 'seo_date_marker', label: '시점 표기', criteria: '기준 시점(연도·월·기준일)이 본문에 명시되면 5, 모호하면 3, 없으면 1' },
      { id: 'seo_outdated_risk', label: '노후화 위험', criteria: '시간이 지나도 유효한 서술이면 5, 일부 만료 가능하면 3, 곧 틀려질 표현이 많으면 1' },
    ],
  },
  {
    id: 'keyword', label: '키워드 자연스러움',
    items: [
      {
        id: 'seo_kw_head', label: '앞부분 키워드 등장',
        criteria: '본문 첫 300자 안에 목표 검색어가 있으면 5, 본문 어딘가에 있으면 3, 없으면 0',
        measure: (_d, m) => {
          if (!m.keyword) return { score: 3, why: '목표 검색어 미지정' };
          if (m.keywordInHead300) return { score: 5, why: '첫 300자 안에 등장' };
          if (m.keywordCount > 0) return { score: 3, why: `본문에 ${m.keywordCount}회, 앞부분엔 없음` };
          return { score: 0, why: '본문에 등장하지 않음' };
        },
      },
      {
        id: 'seo_kw_density', label: '키워드 과최적화',
        criteria: '키워드 밀도 0.5~2.5% 5점, 2.5~4% 3점, 4% 초과(남용) 1점, 0.5% 미만 2점',
        measure: (_d, m) => {
          if (!m.keyword) return { score: 3, why: '목표 검색어 미지정' };
          const p = m.keywordDensity;
          const s = p.toFixed(1) + '%';
          if (p >= 0.5 && p <= 2.5) return { score: 5, why: `밀도 ${s} (적정)` };
          if (p > 2.5 && p <= 4) return { score: 3, why: `밀도 ${s} (다소 높음)` };
          if (p > 4) return { score: 1, why: `밀도 ${s} — 남용으로 보일 수 있음` };
          return { score: 2, why: `밀도 ${s} (낮음)` };
        },
      },
      { id: 'seo_kw_natural', label: '문장 자연스러움', criteria: '키워드가 문장에 자연스럽게 녹아 있으면 5, 어색한 반복이 1~2회면 3, 억지 삽입이 잦으면 1' },
    ],
  },
  {
    id: 'image', label: '이미지 인식성',
    items: [
      {
        id: 'seo_img_count', label: '이미지 개수',
        criteria: '3장 이상 5, 2장 4, 1장 3, 0장 1',
        measure: (_d, m) => band(m.imageCount, [[3, 5], [2, 4], [1, 3]], v => `이미지 ${v}장`),
      },
      {
        id: 'seo_img_label', label: '이미지 설명',
        criteria: '이미지의 80% 이상에 설명이 있으면 5, 절반 이상 3, 그 미만 1, 이미지가 없으면 0',
        measure: (_d, m) => {
          if (m.imageCount === 0) return { score: 0, why: '이미지 없음' };
          const r = m.imageLabeled / m.imageCount;
          const why = `${m.imageCount}장 중 ${m.imageLabeled}장에 설명`;
          if (r >= 0.8) return { score: 5, why };
          if (r >= 0.5) return { score: 3, why };
          return { score: 1, why };
        },
      },
    ],
  },
];

// ── AEO ────────────────────────────────────────────────────────────────
const AEO: RubricArea[] = [
  {
    id: 'lead_answer', label: '핵심답 상단 제시 (역피라미드)',
    items: [
      { id: 'aeo_lead_answer', label: '첫 문단에 결론', criteria: '본문 첫 200자 안에 질문에 대한 결론이 있으면 5, 첫 500자 안이면 3, 중반 이후면 1, 없으면 0' },
      { id: 'aeo_lead_selfcontained', label: '첫 문단 독립성', criteria: '첫 문단만 읽어도 뜻이 통하면 5, 앞뒤 맥락이 있어야 하면 3, 배경 설명뿐이면 1' },
      { id: 'aeo_no_long_intro', label: '군더더기 도입부 없음', criteria: '인사·서론이 100자 이내면 5, 100~300자면 3, 300자 초과면 1' },
    ],
  },
  {
    id: 'qa_structure', label: '질문-답변 구조',
    items: [
      {
        id: 'aeo_question_headings', label: '질문형 소제목',
        criteria: '질문 형태 소제목·문장이 3개 이상 5, 1~2개 3, 0개 1',
        measure: (_d, m) => band(m.questionCount, [[3, 5], [1, 3]], v => `질문형 표현 ${v}개`),
      },
      { id: 'aeo_answer_adjacent', label: '질문 직후 답변', criteria: '질문 바로 다음에 답이 오면 5, 한두 문단 뒤면 3, 흩어져 있으면 1' },
      { id: 'aeo_faq_like', label: 'FAQ 형태 정리', criteria: '자주 묻는 질문을 별도로 정리했으면 5, 본문에 섞여 있으면 3, 없으면 1' },
    ],
  },
  {
    id: 'proposition', label: '단답형 명제 문장',
    items: [
      { id: 'aeo_declarative', label: '단정적 사실 문장', criteria: '"A는 B입니다" 형태의 단정적 사실 문장이 5개 이상 5, 3~4개 4, 1~2개 3, 없으면 1' },
      { id: 'aeo_hedging', label: '모호한 표현 절제', criteria: '"~인 것 같다/~일 수도" 같은 회피 표현이 2개 이하 5, 3~5개 3, 6개 이상 1' },
      {
        id: 'aeo_sentence_short', label: '짧은 문장 비중',
        criteria: '120자 초과 문장이 없으면 5, 1~2개 3, 3개 이상 1',
        measure: (_d, m) => band(-m.longSentences, [[0, 5], [-2, 3]], () => `120자 초과 문장 ${m.longSentences}개`),
      },
      { id: 'aeo_one_idea', label: '한 문장 한 정보', criteria: '대부분 문장이 하나의 정보만 담으면 5, 일부가 여러 정보를 담으면 3, 복문이 많으면 1' },
    ],
  },
  {
    id: 'snippet', label: '발췌 단위',
    items: [
      { id: 'aeo_standalone_para', label: '문단 독립성', criteria: '각 문단이 떼어 놔도 뜻이 통하면 5, 절반쯤 그러면 3, 앞뒤 없이는 안 통하면 1' },
      { id: 'aeo_extractable_block', label: '발췌하기 좋은 덩어리', criteria: '40~120자짜리 요약 문장·목록이 3곳 이상 5, 1~2곳 3, 없으면 1' },
      { id: 'aeo_no_pronoun', label: '지시어 의존 낮음', criteria: '"이것/그것/위에서"처럼 앞을 가리키는 표현이 3개 이하 5, 4~7개 3, 8개 이상 1' },
    ],
  },
  {
    id: 'closing', label: '명확한 요약·결론',
    items: [
      { id: 'aeo_summary', label: '요약 존재', criteria: '핵심을 다시 묶어 주는 요약이 있으면 5, 마무리 인사만 있으면 3, 없으면 1' },
      { id: 'aeo_takeaway', label: '핵심 정리 항목', criteria: '기억할 항목을 3개 이상 명시하면 5, 1~2개 3, 없으면 1' },
      { id: 'aeo_next_action', label: '다음 행동 안내', criteria: '독자가 다음에 할 일을 구체적으로 안내하면 5, 모호하면 3, 없으면 1' },
    ],
  },
];

// ── GEO ────────────────────────────────────────────────────────────────
const GEO: RubricArea[] = [
  {
    id: 'quotable_numbers', label: '인용가능 수치 명시성',
    items: [
      {
        id: 'geo_number_count', label: '구체적 수치 개수',
        criteria: '단위가 붙은 수치가 6개 이상 5, 3~5개 4, 1~2개 3, 0개 0',
        measure: (_d, m) => band(m.numericCount, [[6, 5], [3, 4], [1, 3]], v => `단위 붙은 수치 ${v}개`),
      },
      { id: 'geo_number_context', label: '수치의 맥락', criteria: '각 수치에 기준·시점·범위가 붙어 있으면 5, 일부만 붙으면 3, 맨숫자만 있으면 1' },
      { id: 'geo_number_accuracy', label: '수치 신뢰도', criteria: '검증 가능한 공식 수치면 5, 출처가 불명확하면 3, 어림값·추정이면 1' },
      { id: 'geo_no_vague_qty', label: '모호한 수량 표현 절제', criteria: '"많이/대부분/상당수" 같은 표현이 2개 이하 5, 3~5개 3, 6개 이상 1' },
    ],
  },
  {
    id: 'sources', label: '출처·근거',
    items: [
      { id: 'geo_source_named', label: '출처 명시', criteria: '기관·법령·통계 이름을 2곳 이상 밝히면 5, 1곳 3, 없으면 0' },
      { id: 'geo_source_specific', label: '출처 구체성', criteria: '자료명과 시점까지 밝히면 5, 기관명만 있으면 3, 없으면 0' },
      { id: 'geo_claim_backed', label: '주장-근거 연결', criteria: '핵심 주장마다 근거가 붙으면 5, 일부만 붙으면 3, 근거 없는 단정이 많으면 1' },
    ],
  },
  {
    id: 'primary_info', label: '독창적 1차 정보',
    items: [
      { id: 'geo_primary_data', label: '직접 수집 정보', criteria: '직접 확인·수집한 정보가 있으면 5, 2차 자료 재구성이면 3, 전부 인용이면 1' },
      { id: 'geo_case', label: '구체적 사례', criteria: '실명·실제 사례가 2개 이상 5, 1개 3, 일반화된 예시뿐이면 1' },
      { id: 'geo_added_value', label: '재가공 가치', criteria: '흩어진 정보를 모아 새 표·비교를 만들었으면 5, 단순 나열이면 3, 복붙 수준이면 1' },
    ],
  },
  {
    id: 'entity', label: '개체·용어 정의',
    items: [
      { id: 'geo_term_defined', label: '전문용어 설명', criteria: '처음 나오는 전문용어를 모두 풀어 주면 5, 일부만 3, 설명 없이 쓰면 1' },
      { id: 'geo_entity_full', label: '개체 정식 명칭', criteria: '기관·제도·단지 이름을 정식 명칭으로 쓰면 5, 약칭 혼용이면 3, 모호하면 1' },
      { id: 'geo_scope_clear', label: '적용 범위 명시', criteria: '어떤 조건에서 성립하는 이야기인지 밝히면 5, 일부만 3, 없으면 1' },
    ],
  },
  {
    id: 'trust', label: '신뢰 신호',
    items: [
      { id: 'geo_authorship', label: '작성자 관점', criteria: '누가 어떤 자격으로 쓴 글인지 드러나면 5, 암시적이면 3, 전혀 없으면 1' },
      { id: 'geo_balance', label: '균형 서술', criteria: '장단점·반론을 같이 다루면 5, 한쪽만 다루되 과장 없으면 3, 일방적 홍보면 1' },
      { id: 'geo_disclaimer', label: '한계·주의 고지', criteria: '정보의 한계나 확인 필요를 안내하면 5, 부분적이면 3, 단정만 있으면 1' },
    ],
  },
  {
    id: 'clarity', label: '구조적 명료성',
    items: [
      { id: 'geo_hierarchy', label: '정보 위계', criteria: '큰 주제-작은 주제 위계가 뚜렷하면 5, 평면적이면 3, 뒤섞였으면 1' },
      { id: 'geo_parseable', label: '기계 판독 용이성', criteria: '소제목·목록·표로 구획이 뚜렷하면 5, 일부만 3, 줄글 뭉치면 1' },
    ],
  },
];

export const AXES: RubricAxis[] = [
  { id: 'seo', label: 'SEO', desc: '검색 결과에서 발견되고 선택될 가능성', areas: SEO },
  { id: 'aeo', label: 'AEO', desc: '사용자의 질문에 직접 답할 가능성', areas: AEO },
  { id: 'geo', label: 'GEO', desc: 'AI 답변의 근거·출처로 인용될 가능성', areas: GEO },
];

export const ALL_ITEMS: (RubricItem & { axis: string; area: string; areaLabel: string })[] =
  AXES.flatMap(ax => ax.areas.flatMap(ar =>
    ar.items.map(it => ({ ...it, axis: ax.id, area: ar.id, areaLabel: ar.label }))));

/** AI가 판단해야 하는 항목 (measure 가 없는 것) */
export const LLM_ITEMS = ALL_ITEMS.filter(i => !i.measure);
/** 코드가 직접 세는 항목 */
export const AUTO_ITEMS = ALL_ITEMS.filter(i => i.measure);

export const MAX_PER_ITEM = 5;

/**
 * 채점 프롬프트.
 *
 * ⚠️ 이 문구도 채점 기준의 일부다. 만들면서 확인했는데, 항목은 그대로 두고
 * 지시문 두 줄만 뺐더니 같은 원고의 GEO 점수가 57에서 49로 움직였다.
 * 그래서 항목·버전과 같은 파일에 둔다 — 프롬프트만 고치고 RUBRIC_VERSION 을
 * 안 올리면, 나중에 점수가 변했을 때 원인을 찾을 수 없다.
 *
 * 이 함수를 고치면 반드시 RUBRIC_VERSION 도 올릴 것.
 */
export function buildScoringPrompt(doc: QualityDoc): string {
  const rubricText = LLM_ITEMS
    .map(i => `${i.id} (${i.areaLabel} > ${i.label}): ${i.criteria}`)
    .join('\n');

  return `당신은 한국어 블로그 원고를 정해진 기준으로만 채점하는 평가자입니다.
개인 취향이나 인상으로 판단하지 말고, 아래에 적힌 수치 기준에만 맞춰 점수를 주세요.

[채점 기준] 각 항목 0~${MAX_PER_ITEM}점
${rubricText}

[목표 검색어]
${doc.targetKeyword || '(지정되지 않음 — 이 경우 검색어 관련 항목은 3점)'}

[원고 제목]
${doc.title || '(제목 없음)'}

[원고 본문]
${doc.body}

모든 항목을 빠짐없이 채점하세요. 근거(why)는 원고에서 확인한 사실만 40자 이내로 쓰고,
"좋음/나쁨" 같은 평가어 대신 무엇이 몇 개 있었는지처럼 확인 가능한 내용을 쓰세요.
순수 JSON만 답하세요.
{"items":[{"id":"항목id","score":0,"why":"근거"}]}`;
}

/** 축별 100점 환산 + 종합. 합산은 코드가 한다 — 산수를 AI에게 맡길 이유가 없다. */
export function aggregate(scores: Record<string, number>) {
  const perAxis: Record<string, { score: number; got: number; max: number }> = {};
  for (const ax of AXES) {
    const items = ax.areas.flatMap(a => a.items);
    const got = items.reduce((sum, it) => sum + (scores[it.id] ?? 0), 0);
    const max = items.length * MAX_PER_ITEM;
    perAxis[ax.id] = { score: Math.round((got / max) * 100), got, max };
  }
  // 세 축을 같은 비중으로 본다. 어느 하나가 특별히 더 중요하다고 볼 근거가 없다.
  const total = Math.round((perAxis.seo.score + perAxis.aeo.score + perAxis.geo.score) / 3);
  return { perAxis, total };
}
