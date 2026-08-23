import { createClient } from '@supabase/supabase-js';
import { callOpenRouter } from '@/lib/ai/openrouter';
import { buildArticleRules } from '@/lib/blog/qualityRubric';
import { withTagLine } from '@/lib/blog/tagLine';
import { extractJson } from '@/lib/blog/extractJson';
import { getSlideImageUrls, toBlogImageSlots } from '@/lib/cardnews/slideImages';
import {
  usableSources, buildSourceListForPrompt, citedIndexes, buildSourceSection,
} from '@/lib/blog/newsSources';

// 브리핑 한 건을 블로그 글로 만들어 보관함에 저장한다.
//
// 라우트(사람이 화면에서 누르는 길)와 크론(10시 자동)이 같은 코드를 쓰도록
// 함수로 빼 뒀다. 두 벌로 두면 한쪽만 고쳐져서 자동으로 만든 글만 기준이
// 달라진다.

export type SaveBriefingResult =
  | { ok: true; skipped: true; postId: string; reason: string }
  | { ok: true; skipped: false; postId: string; title: string }
  | { ok: false; status: number; error: string };

/**
 * @param briefingId 없으면 최신 브리핑
 * @param cardnewsDesignId 같은 브리핑으로 만든 카드뉴스. 주면 그 카드를 글의
 *        그림으로 같이 넣는다 — 인스타에 올리며 그린 것이 있으면 그대로 쓴다.
 */
export async function saveBriefingAsBlog(
  briefingId?: string,
  cardnewsDesignId?: string,
): Promise<SaveBriefingResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, status: 500, error: 'Supabase 설정이 없습니다.' };

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let q = supabase.from('briefings').select('*');
  q = briefingId
    ? q.eq('id', briefingId)
    : q.order('created_at', { ascending: false }).limit(1);

  const { data: briefing, error: bErr } = await q.maybeSingle();
  if (bErr) return { ok: false, status: 500, error: bErr.message };
  if (!briefing) return { ok: false, status: 404, error: '대상 브리핑 데이터를 찾을 수 없습니다.' };

  const targetId = briefing.id;
  const report = briefing.full_report || briefing.real_estate_summary;
  if (!report) {
    return { ok: false, status: 400, error: '브리핑 본문(full_report / real_estate_summary)이 비어 있습니다.' };
  }

  // 뉴스 수집이 실패한 브리핑으로는 글을 만들지 않는다.
  //
  // full_report 는 '뉴스 + Meta 광고 성과' 두 부분이라, 뉴스가 실패해도
  // 광고 섹션이 남아 본문이 비지 않는다. 2026-07-24에 실제로 뉴스가
  // "에러가 발생했습니다" 한 줄인 브리핑으로 광고 리포트 글이 나갔다.
  const newsFailed =
    /수집된 부동산 뉴스가 없습니다|브리핑 생성 과정에서 에러/.test(report) ||
    !Array.isArray(briefing.news_items) ||
    briefing.news_items.length === 0;
  if (newsFailed) {
    return {
      ok: false,
      status: 422,
      error:
        '이 브리핑은 뉴스 수집이 실패해 광고 성과만 남아 있습니다. ' +
        '그대로 글을 만들면 부동산 소식이 아니라 광고 리포트가 됩니다. ' +
        '브리핑을 다시 생성한 뒤 시도해주세요.',
    };
  }

  const { data: existing } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('briefing_id', targetId)
    .maybeSingle();
  if (existing) {
    return { ok: true, skipped: true, postId: existing.id, reason: '이 브리핑으로 만든 글이 이미 있습니다.' };
  }

  // 브리핑이 모아 둔 실제 기사를 근거로 준다.
  //
  // 지어낸 출처는 없느니만 못하므로 목록에 있는 것만 쓰게 하고, 주소는
  // 아예 넘기지 않는다 — 보여주면 본문에 옮겨 적다가 틀리게 쓴다.
  const sources = usableSources(briefing.news_items);
  const dateLabel = String(briefing.date || '').slice(0, 10);
  const sourceBlock = sources.length
    ? `
[근거로 쓸 수 있는 오늘의 기사]
${buildSourceListForPrompt(sources, dateLabel)}
`
    : '';
  const sourceRules = sources.length
    ? `
[출처 규칙]
- 위 목록에 있는 기사만 근거로 쓰세요. 목록에 없는 언론사·기관·보고서 이름을 지어내지 마세요.
- 근거가 되는 문장 끝에 [1] 처럼 기사 번호를 답니다. 소제목마다 최소 한 번은 답니다.
- 기사에 기관·법령·통계 이름(예: 국토교통부, 한국부동산원)이 나오면 본문에 그대로 밝히고, 언제 기준인지(${dateLabel}) 같이 적으세요.
- 주소(URL)는 절대 쓰지 마세요. 번호만 쓰면 주소는 저장할 때 자동으로 붙습니다.
- 기사에 없는 수치는 만들지 마세요. 확실하지 않으면 그 문장을 빼세요.
`
    : '';

  const systemPrompt = `당신은 전문 부동산 블로그 에디터입니다.
제공된 일일 부동산 브리핑 원문을 바탕으로 독자들이 읽기 쉽고 유익한 블로그 포스팅으로 재가공하세요.

[필수 요구사항]
1. 원문 브리핑의 사실 및 수치를 임의로 수정하거나 지어내지 마세요.
2. 소제목으로 명확히 구분하여 가독성이 뛰어난 글 구조를 작성하세요.
3. 본문 분량은 공백 포함 1,500자~2,500자 정도로 작성하세요.
4. 부동산에 관심 있는 일반 독자를 대상으로 차분하고 담백하며 친절한 정보 전달 톤을 유지하세요.
5. 응답은 반드시 마크다운 코드펜스나 설명 문구 없이 오직 순수한 JSON 객체만 반환하세요.

${buildArticleRules({ sectionCount: 5 })}
${sourceRules}
[반환 JSON 스키마]
{
  "title": "35자 이내, 클릭을 부르되 과장 없는 제목",
  "meta_description": "100자 이내 요약",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"],
  "body": "블로그 본문 내용 (소제목 ## 포함)",
  "used_sources": [1, 2, 3]
}`;

  // 모델을 haiku 로 고정하고 한 번 더 시도한다.
  //
  // 기본값(deepseek)으로 두 번 돌려 보니 한 번은 빈 응답이 왔다. 사람이
  // 보고 다시 누르는 자리면 상관없지만 이건 혼자 도는 작업이라, 한 번
  // 실패하면 그날 글이 없다. haiku 는 채점 기능을 만들며 재본 결과 같은
  // 입력에 같은 결과를 안정적으로 돌려줬다.
  const MODEL = 'anthropic/claude-haiku-4.5';
  const userPrompt =
    '아래 일일 브리핑 원문을 바탕으로 블로그 글을 작성해 주세요.' +
    String.fromCharCode(10, 10) + '[일일 브리핑 원문]' + String.fromCharCode(10) + report +
    sourceBlock;

  let raw = '';
  let lastErr = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      raw = await callOpenRouter({ prompt: userPrompt, system: systemPrompt, model: MODEL, maxTokens: 4000 });
      if (raw.trim()) break;
      lastErr = '빈 응답';
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    console.warn(`[to-blog] ${attempt}번째 시도 실패: ${lastErr}`);
  }
  if (!raw.trim()) return { ok: false, status: 500, error: `AI 생성 실패: ${lastErr}` };

  // 펜스를 지우고 JSON.parse 하는 기존 방식으로는 깨진다. 긴 한국어 본문이
  // 오면 모델이 body 안에 진짜 줄바꿈을 넣어 보내서 "Bad control character"
  // 로 죽었다 — 실제로 이 경로에서 그렇게 실패했다.
  let parsed: { title?: string; meta_description?: string; tags?: string[]; body?: string; used_sources?: unknown };
  try {
    parsed = extractJson(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[to-blog] JSON 파싱 실패:', msg, raw.slice(0, 300));
    return { ok: false, status: 500, error: `AI 응답 JSON 파싱 실패: ${msg}` };
  }

  if (!parsed.body || !parsed.title) {
    return { ok: false, status: 500, error: 'AI 응답에 필수 필드(title, body)가 누락되었습니다.' };
  }

  const tags = parsed.tags || [];

  // 본문에 달린 [n] 과 AI가 알려준 목록을 합쳐 실제 주소를 붙인다.
  const cited = citedIndexes(parsed.body, parsed.used_sources, sources.length);
  const sourceSection = buildSourceSection(sources, cited, dateLabel);
  if (sources.length) console.log(`[to-blog] 출처 ${cited.length}건 첨부 (기사 ${sources.length}건 중)`);

  // 카드 그림을 같이 넣는다.
  //
  // 글만 저장하면 다시 열었을 때 이미지가 0장이라, 네이버에 붙여넣을 그림을
  // 따로 만들어야 했다. 화면에서 카드뉴스를 골라 만들 때는 들어가는데
  // 서버에서 만드는 길만 빠져 있었다.
  //
  // 어느 카드뉴스인지는 호출부가 안 알려줘도 찾을 수 있다. 아침 초안은
  // description 에 'briefing:<id>' 를 달고 저장되므로 그걸로 짝을 짓는다.
  let designId = cardnewsDesignId;
  if (!designId) {
    const { data: pair } = await supabase
      .from('card_designs')
      .select('id')
      .eq('description', `briefing:${targetId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    designId = (pair as { id?: string } | null)?.id;
  }
  const slideUrls = designId ? await getSlideImageUrls(designId, 90_000) : [];

  const { data: post, error: insErr } = await supabase
    .from('blog_posts')
    .insert({
      images_data: toBlogImageSlots(slideUrls),
      title: parsed.title.trim(),
      // 본문 → 출처 → 해시태그 순서. 해시태그가 맨 끝에 와야 네이버에
      // 붙여넣었을 때 태그로 잡힌다.
      body: withTagLine(parsed.body + sourceSection, tags),
      meta_description: parsed.meta_description?.trim() || null,
      tags,
      topic: '부동산 브리핑',
      format: 'briefing',
      briefing_id: targetId,
    })
    .select('id, title')
    .single();

  if (insErr) return { ok: false, status: 500, error: `blog_posts 저장 실패: ${insErr.message}` };

  console.log(`[to-blog] 블로그 저장 완료: ${post.title}`);
  return { ok: true, skipped: false, postId: post.id, title: post.title };
}
