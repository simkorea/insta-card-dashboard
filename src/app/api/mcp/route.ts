import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { toKoreanError } from '@/lib/gemini';
import { callAI } from '@/lib/ai/openrouter';
import { extractArticle } from '@/lib/extractArticle';
import { buildDraftPages } from '@/lib/mcp/buildDraftPages';
import { exactSlideSchema, buildExactBlocks, checkExactSlides } from '@/lib/mcp/exactSlides';
import { captureDesignSlides } from '@/lib/cardnews/captureSlides';
import { generateBlogFromCardnews } from '@/lib/cardnews/cardnewsToBlog';
import { toBlogImageSlots } from '@/lib/cardnews/slideImages';
import { generateBlogPost } from '@/lib/blog/generateBlogPost';
import { withTagLine } from '@/lib/blog/tagLine';
import { buildZipManifest, ymdKst } from '@/lib/blog/zipManifest';
import { fetchMolitTrades } from '@/lib/aptList/fetchMolit';
import { findSigungu } from '@/lib/aptList/lawdCodes';

// 준형 혼자 쓰는 1단계 MCP 서버. 인증은 고정 비밀 토큰(Bearer) 하나뿐이다.
// 문서: docs/mcp-phase1-prompt.md
//
// 이 라우트는 기존 라우트를 호출하지 않는다(A안, 승인받음) — 재사용한 로직은
// 코드 블록마다 "원본: <경로>" 주석을 달아 원본이 바뀌면 같이 고칠 수 있게 했다.
// 기존 라우트(api/generate/unified, api/designs, api/scheduled-posts,
// api/instagram/insights, api/insights/best-time)는 이번 작업으로 전혀 바뀌지 않았다.

export const maxDuration = 300;

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const IG_API = 'https://graph.facebook.com/v21.0';

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}
function fail(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

// KST(타임존 없는) 입력을 +09:00 ISO로 바꾼다. 이미 타임존이 있으면 그대로 둔다.
function toKstIso(input: string): string | null {
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(input.trim());
  const withZone = hasZone ? input.trim() : `${input.trim().replace(' ', 'T')}+09:00`;
  const d = new Date(withZone);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const handler = createMcpHandler(
  (server) => {
    // ── list_designs ────────────────────────────────────────────────────
    server.registerTool(
      'list_designs',
      {
        title: '카드뉴스 목록',
        description: '최근 카드뉴스 디자인 목록(id, 제목, 생성일, 슬라이드 수, 편집기 링크)을 조회합니다.',
        inputSchema: z.object({
          limit: z.number().int().min(1).max(50).default(10),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ limit }) => {
        // 원본: src/app/api/designs/route.ts (GET) — 원본은 select('*') 전체 반환,
        // 여기서는 목록에 필요한 컬럼만 줄여서 가져오고 pages_data는 슬라이드 수만 남긴다.
        const { data, error } = await supabase
          .from('card_designs')
          .select('id, name, category, created_at, pages_data')
          .order('created_at', { ascending: false })
          .limit(limit ?? 10);

        if (error) return fail(`조회 실패: ${error.message}`);

        const rows = (data ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          createdAt: d.created_at,
          slideCount: Array.isArray(d.pages_data) ? d.pages_data.length : 0,
          editorUrl: `${siteOrigin()}/cardnews/editor?id=${d.id}`,
        }));

        return ok(JSON.stringify(rows, null, 2));
      }
    );

    // ── generate_cardnews ───────────────────────────────────────────────
    server.registerTool(
      'generate_cardnews',
      {
        title: '카드뉴스 초안 생성',
        description:
          '주제(텍스트) 또는 URL로 카드뉴스 초안을 생성해 보관함에 저장합니다. 배경 이미지 없이 텍스트/블록만 채워 저장하므로, 저장 후 render_design으로 렌더한 모습을 확인하거나 편집기에서 다듬는 것을 권장합니다.',
        inputSchema: z.object({
          topic: z.string().optional().describe('카드뉴스 주제 텍스트. url과 둘 중 하나는 필수.'),
          url: z.string().url().optional().describe('원문 기사 URL. topic과 둘 중 하나는 필수.'),
          slideCount: z.union([z.number().int().min(3).max(10), z.literal('auto')]).default('auto'),
          tone: z.enum(['origin', 'free']).optional().describe('origin: 원본 유지, free: 자유 변형'),
          outputLanguage: z.string().optional(),
          style: z
            .enum(['note', 'impact'])
            .optional()
            .describe('note: 손글씨 노트(기본, 정보 전달용), impact: 어두운 바탕에 큰 글자(상담 유입용)'),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ topic, url, slideCount, tone, outputLanguage, style }) => {
        if (!topic && !url) return fail('topic 또는 url 중 하나는 필요합니다.');

        let inputContent = topic || '';
        const sourceMode: 'url' | 'text' = topic ? 'text' : 'url';

        if (url && !topic) {
          try {
            // 원본: src/app/api/generate/from-url/route.ts 와 달리 unified와 같은
            // extractArticle을 쓴다 — 원본: src/app/api/generate/unified/route.ts
            const article = await extractArticle(url);
            inputContent = article.text;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return fail(`해당 주소에서 본문을 읽지 못했습니다: ${msg}`);
          }
        }
        if (!inputContent) return fail('본문 내용이 비어 있습니다.');

        // 원본: src/app/api/generate/unified/route.ts (33~136줄) — 프롬프트 문구.
        // 원본 수정 시 같이 검토할 것. templateTitle/extraInstruction 없이 최소화했다.
        const slideInstruction =
          slideCount === 'auto' || !slideCount
            ? '카드뉴스는 내용에 맞춰 4~7장 사이로 적절히 생성할 것'
            : `카드뉴스는 정확히 ${slideCount}장으로 생성할 것`;

        let genStyleInstruction = '';
        if (tone === 'origin') {
          genStyleInstruction = `\n- 스타일 지침: 원본 유지 스타일입니다. 템플릿의 고유한 색상 배합과 레이아웃 구조를 최대한 그대로 재사용하여 브랜딩의 통일성을 기하세요.`;
        } else if (tone === 'free') {
          genStyleInstruction = `\n- 스타일 지침: 자유 변형 스타일입니다. 생성된 콘텐츠의 개별 맥락과 내용적 필요에 따라 AI가 창의적이고 자유롭게 레이아웃 및 디자인 요소를 다채롭게 구성해 꾸미도록 지시하세요.`;
        }

        // impact 는 상담 유입용 — 표지는 짧은 훅, 마지막 장은 저장·행동 유도.
        // 한 줄 제목이 크게 찍히므로 길이 제한을 더 조인다.
        const impactInstruction =
          style === 'impact'
            ? `\n    [임팩트 스타일 지침]
    - 첫 장 headline은 공백 포함 12자 안팎의 짧은 훅(숫자 또는 손해 회피)으로, accentText 없이 마지막 낱말이 눈에 띄게 쓸 것.
    - 마지막 장은 "저장해 두고 확인하세요"처럼 저장·행동을 유도하는 문구로 마무리할 것.
    - 중간 장은 번호가 붙는 checklist 위주로 구성할 것.`
            : '';

        const sourceFidelityBlock =
          sourceMode === 'url'
            ? `\n    [원문 충실도 — 매우 중요]
    - 아래 "내용"은 사용자가 지정한 기사 원문입니다. 이 기사에 실제로 담긴 사실만 사용하세요.
    - 기사에 없는 수치·지역·단지명·일정·가격을 새로 지어내지 마세요.
    - 기사의 주제를 다른 주제로 바꾸지 마세요. 카드뉴스 전체가 이 기사 한 건을 설명해야 합니다.
    - 기사에서 확인되지 않는 내용은 아예 쓰지 말고, 대신 기사에 있는 다른 사실로 채우세요.`
            : '';

        const languageInstruction = outputLanguage
          ? `\n    [출력 언어]\n    - 카드뉴스 문구 등 모든 사용자 노출 텍스트를 ${outputLanguage}로 작성할 것. (imageKeyword는 예외 — 항상 영어)`
          : '';

        const prompt = `당신은 프로페셔널한 SNS 마케터이자 전문 카피라이터입니다.
    제공된 내용을 바탕으로 카드뉴스를 생성하세요.${genStyleInstruction}

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
          "blocks": [
            { "type": "eyebrow", "text": "HOT ISSUE" },
            { "type": "headline", "text": "핵심 제목", "accentText": "강조어" },
            { "type": "badgeRow", "badges": [{ "text": "핵심 정보", "tone": "gold" }] }
          ]
        }
      ]
    }

    [지침]
    1. cardNews: ${slideInstruction}.
    2. imageKeyword: 영어 키워드(사용하지 않지만 형식은 유지할 것).

    [블록 타입 정의]
    - { "type":"eyebrow", "text": "섹션 라벨 (영문 대문자 권장)" }
    - { "type":"headline", "text":"메인 제목", "accentText":"강조할 일부(선택)" }
    - { "type":"sub", "text":"보조 설명" }
    - { "type":"bigNumber", "value":"7억대", "caption":"설명(선택)" }
    - { "type":"statGrid", "cols":3, "items":[{"value":"39%","label":"민간 대비 저렴"}] }
    - { "type":"compareTable", "rows":[{"label":"84㎡","value":"7억 3,245만원","highlight":true}] }
    - { "type":"timeline", "items":[{"date":"2026.6.12","title":"당첨자 발표","desc":"설명(선택)","state":"active"}] }
    - { "type":"checklist", "items":["항목1","항목2"] }
    - { "type":"badgeRow", "badges":[{"text":"핵심 정보","tone":"gold"}] }
    - { "type":"sourceNote", "text":"출처: ..." }

    [blocks 생성 필수 규칙]
    - 각 카드의 blocks 배열은 비워두지 말고 1개 이상의 유효한 블록으로 작성하세요.
    - 맨 앞 eyebrow 1개 + headline 1개 + 내용 블록 1개 이상.
    - 모든 슬라이드의 headline은 공백 포함 18자 이내로 작성할 것.
    - accentText는 headline 안에서 강조할 3~6자 정도의 짧은 조각만 지정할 것.
    - sub(부제) 텍스트는 공백 포함 40자 이내로 작성할 것.
    - 주제가 비즈니스/부동산/세금/금융이면 brandTone "gold", 라이프/여행/패션/건강이면 "sage".
${impactInstruction}${sourceFidelityBlock}${languageInstruction}
내용: ${inputContent}`;

        let text: string;
        try {
          text = await callAI({ prompt, model: 'anthropic/claude-haiku-4.5', maxTokens: 8000 });
        } catch (e: unknown) {
          return fail(toKoreanError(e));
        }

        try {
          if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
          else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();
          const data = JSON.parse(text);
          if (!Array.isArray(data?.cardNews) || data.cardNews.length === 0) {
            return fail('AI가 카드뉴스를 생성하지 못했습니다.');
          }

          // 새 코드: src/lib/mcp/buildDraftPages.ts — unified 응답을 pages_data로 변환
          const pagesData = buildDraftPages(data.cardNews, '4:5', style ?? 'note');

          // 원본: src/app/api/designs/route.ts (POST) — 원본은 anon key를 쓰지만
          // 여기서는 CLAUDE.md 규칙대로 service role을 쓴다(원본 수정 시 이 차이 유지 여부 재검토).
          const name = `[MCP] ${pagesData[0]?.title || '카드뉴스'}`.slice(0, 80);
          const { data: design, error: insErr } = await supabase
            .from('card_designs')
            .insert({ name, description: 'source:mcp', pages_data: pagesData })
            .select('id, name')
            .single();

          if (insErr) return fail(`저장 실패: ${insErr.message}`);

          return ok(
            JSON.stringify(
              {
                designId: design.id,
                name: design.name,
                slides: pagesData.length,
                editorUrl: `${siteOrigin()}/cardnews/editor?id=${design.id}`,
                note: '배경 이미지 없이 저장되었습니다. render_design으로 렌더한 모습을 먼저 확인하세요.',
              },
              null,
              2
            )
          );
        } catch (e) {
          console.error('[mcp:generate_cardnews] JSON 파싱 실패. 원본 응답:', text, e);
          return fail('AI 응답 데이터 형식이 올바르지 않습니다.');
        }
      }
    );

    // ── save_cardnews_exact ─────────────────────────────────────────────
    // generate_cardnews(tone:'origin')도 AI가 문구를 바꿨다(2026-10-10, "주요 간선도로로
    // 연결된 우수한 입지" 등). 분양 광고라 과장 표현이 끼면 안 되므로, 이미 검수된 원고는
    // AI를 거치지 않고 받은 글자 그대로 저장한다.
    server.registerTool(
      'save_cardnews_exact',
      {
        title: '카드뉴스 원문 그대로 저장',
        description:
          '이미 검수된 카드뉴스 원고를 AI 수정 없이 한 글자도 바꾸지 않고 보관함에 저장합니다. 장마다 headline(제목, ≤18자)·body(본문, ≤120자)·points(항목 ≤4개 각 ≤20자, 선택)를 주면 그대로 카드에 들어갑니다. ' +
          '선택 칸(주지 않으면 예전과 똑같이 저장): eyebrow(띠지 ≤12자, 예 "① 혜택"), stats(숫자표 최대 3개, value ≤10자·label ≤12자), badges(배지 최대 3개 각 ≤8자), source(출처 ≤40자). 주면 그 자리에 그대로 그려집니다. ' +
          '주의: 노트·신문 카드는 points 가 있으면 badges 를 그리지 않으므로 같은 장에 둘을 같이 주면 거절합니다. stats 와 points 를 같이 주면 points 제목이 "장점"으로 나옵니다(카드 고정 문구). ' +
          '최상위 noteLabel(도장 라벨 ≤8자, 예 "분양노트")·noteNumber(≤10자, 없으면 "No.MMDD" 자동)는 노트·신문 카드 오른쪽 아래 도장이 됩니다. 둘 다 안 주면 도장이 없습니다(impact 는 noteNumber 를 쪽번호로 쓰고 noteLabel 만 라벨 자리에 씁니다). ' +
          'style: note(손글씨 노트, 기본)·paper(신문 지면)·impact(어두운 바탕 큰 글자). 저장 후 render_design으로 이미지를 만드세요. 문구를 새로 써야 하면 generate_cardnews를 쓰세요.',
        inputSchema: z.object({
          slides: z.array(exactSlideSchema).min(3).max(10),
          caption: z.string().max(500).optional().describe('인스타 캡션. 저장하지 않고 그대로 돌려준다(schedule_post에 넘길 것).'),
          title: z.string().min(1).max(60).optional().describe('보관함에 보일 이름'),
          style: z
            .enum(['note', 'impact', 'paper'])
            .optional()
            .describe('note: 손글씨 노트(기본), paper: 신문 지면, impact: 어두운 바탕에 큰 글자'),
          noteLabel: z.string().min(1).max(8).optional().describe('노트 도장 라벨. 예: 분양노트'),
          noteNumber: z.string().min(1).max(10).optional().describe("노트 도장 번호. 없으면 noteLabel 을 줄 때 'No.MMDD' 자동"),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ slides, caption, title, style, noteLabel, noteNumber }) => {
        const bad = checkExactSlides(slides);
        if (bad) return fail(bad);

        // buildDraftPages 재사용 — 문구를 건드리는 곳은 normalizeHeadlines 뿐인데,
        // accentText가 없으면 블록을 그대로 돌려준다(normalizeHeadline.ts). 그래서 accentText를
        // 넣지 않는다(입력에 없는 글자가 카드에 생기지 않게). 블록 변환은 exactSlides.ts.
        const cards = slides.map((s) => ({
          title: s.headline,
          subtitle: s.body,
          blocks: buildExactBlocks(s),
        }));
        const pagesData = buildDraftPages(cards, '4:5', style ?? 'note', { noteLabel, noteNumber });

        const name = (title ?? `[MCP] ${slides[0].headline}`).slice(0, 80);
        const { data: design, error: insErr } = await supabase
          .from('card_designs')
          .insert({ name, description: 'source:mcp-exact', pages_data: pagesData })
          .select('id, name')
          .single();

        if (insErr) return fail(`저장 실패: ${insErr.message}`);

        return ok(
          JSON.stringify(
            {
              designId: design.id,
              name: design.name,
              slides: pagesData.length,
              editorUrl: `${siteOrigin()}/cardnews/editor?id=${design.id}`,
              ...(caption !== undefined ? { caption } : {}),
              note: '입력 문구를 AI 수정 없이 그대로 저장했습니다(배경 이미지 없음). render_design으로 렌더하세요.',
            },
            null,
            2
          )
        );
      }
    );

    // ── cardnews_to_blog ────────────────────────────────────────────────
    server.registerTool(
      'cardnews_to_blog',
      {
        title: '카드뉴스 → 블로그 원고',
        description:
          '승인된 카드뉴스 한 벌(designId)로 네이버 블로그 원고를 만들어 돌려줍니다. 화면의 "카드뉴스로 블로그까지 한 번에"(/api/generate/from-cardnews)와 같은 생성 코드를 쓰되, DB에 저장하지 않고 게시·예약·SNS 업로드도 하지 않습니다. 생성된 글은 손대지 않고 그대로 돌려줍니다. ' +
          '카드 그림: slideImageUrls(render_design이 돌려준 주소)를 넘기면 새로 그리지 않고 그 주소를 그대로 씁니다. 슬라이드 수와 개수가 같아야 하고, 우리 Supabase 저장소(card-images 버킷)의 https 주소이면서 경로에 이 designId가 든 것만 받으며 아니면 AI를 부르기 전에 거절합니다. ' +
          '안 넘기면 이미 예약하며 그려 둔 그림이 있을 때만 재사용하고, 없으면 서버가 새로 그려 저장소에 PNG를 올립니다(render_design과 같음). 그림을 못 구하면 이미지 없이 글만 돌려줍니다. ' +
          '응답의 zip 항목은 블로그 생성기 화면 "전체 다운로드"가 만드는 ZIP과 같은 구성입니다. 바깥 스크립트는 zip.entries 대로 ZIP을 만들면 됩니다: ' +
          '(1) 원고 파일 1개 — 이름 zip.manuscriptFileName("YYYYMMDD_주제.txt"), 내용은 zip.manuscriptText 그대로(UTF-8). ' +
          '원고는 줄 전체가 [제목] / [메타설명] / [태그] / [본문] 인 섹션 머리로 나뉘고, [태그]는 "#a, #b" 쉼표 구분, [본문] 끝에 해시태그 줄이 붙고 파일 끝에 줄바꿈 1개가 있습니다. ' +
          '(2) 이미지 — 이름 "{슬롯번호}_{라벨}.jpg"(라벨이 없으면 "{슬롯번호}_image_{슬롯번호}.jpg", 예: 1_image_1.jpg), 내용은 images[].url 을 내려받은 것. 슬롯 번호가 표시 순서이며 그림이 없는 슬롯은 번호를 건너뜁니다. 확장자는 .jpg 로 붙이지만 카드 그림은 실제로 PNG 입니다(화면 ZIP도 같음). ' +
          '(3) ZIP 파일 이름 zip.fileName("YYYYMMDD_주제.zip") — 파일명 앞 8자리가 글 날짜로 읽힙니다. 원고 .txt 는 ZIP 안에 하나만 넣으세요(첫 .txt 를 원고로 읽음). ' +
          '이 ZIP을 네이버 블로그 업로드 프로그램(publish.py)이 "카드뉴스 신규\\블로그" 폴더에서 읽습니다. ' +
          'AI 글 생성에 시간(보통 30~90초)과 AI 사용량이 듭니다.',
        inputSchema: z.object({
          designId: z.string().uuid().describe('승인된 카드뉴스 디자인 id (list_designs / render_design의 designId)'),
          slideImageUrls: z
            .array(z.string())
            .min(1)
            .optional()
            .describe('선택. render_design으로 이미 받은 슬라이드 그림 주소(슬라이드 수와 같은 개수, 순서대로). 주면 새로 그리지 않는다.'),
          format: z
            .enum(['naver', 'tistory', 'instagram'])
            .default('naver')
            .describe('글 형식. 기본 naver (from-cardnews와 같은 뜻)'),
          tone: z
            .enum(['professional', 'friendly', 'trendy', 'emotional', 'informative', 'persuasive'])
            .default('professional')
            .describe('글 톤. 기본 professional (from-cardnews와 같은 뜻)'),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ designId, slideImageUrls, format, tone }) => {
        // 원본: src/app/api/generate/from-cardnews/route.ts — 앞부분(읽기→근거→생성→카드 그림)을
        // src/lib/cardnews/cardnewsToBlog.ts 로 빼서 같은 코드를 쓴다. 저장(blog_posts)과
        // 영상 재료는 쓰지 않는다. 쿠키가 없어서 /api/generate/blog 를 HTTP로 부르지 않고
        // 그 본체(src/lib/blog/generateBlogPost.ts)를 직접 부른다.
        const result = await generateBlogFromCardnews({
          supabase,
          designId,
          format: format ?? 'naver',
          tone: tone ?? 'professional',
          slideImageUrls,
          generateBlog: async ({ topic, format: f, tone: t }) => {
            const r = await generateBlogPost({ topic, format: f, tone: t });
            if (r.status < 200 || r.status >= 300 || r.json?.error) {
              return {
                ok: false,
                error: r.json?.error || '블로그 생성에 실패했습니다.',
                status: r.status === 200 ? 500 : r.status,
              };
            }
            return { ok: true, blog: r.json };
          },
        });
        if (!result.ok) return fail(`${result.error} (코드 ${result.status})`);

        const { design, blog, slideUrls } = result;
        const title = blog.title || design.name;
        const tags = Array.isArray(blog.tags) ? blog.tags : [];
        const slots = toBlogImageSlots(slideUrls);

        // 원본: src/app/blog-generator/page.tsx (downloadZip) — 이름·원고 형식은
        // src/lib/blog/zipManifest.ts 로 빼서 화면과 같은 함수를 쓴다.
        const manifest = buildZipManifest({
          dateStr: ymdKst(),
          topic: design.name,
          title,
          metaDescription: blog.metaDescription || '',
          tags,
          // 화면에서 저장·다운로드할 때와 같게 — 붙여넣으면 태그도 같이 간다
          bodyWithTags: withTagLine(blog.body || '', tags),
          slots,
        });

        return ok(
          JSON.stringify(
            {
              designId: design.id,
              designName: design.name,
              format: format ?? 'naver',
              tone: tone ?? 'professional',
              // 생성된 그대로 (태그 줄을 붙이거나 다듬지 않음)
              blog: { title, body: blog.body, metaDescription: blog.metaDescription, tags: blog.tags },
              images: manifest.images,
              zip: {
                fileName: manifest.zipFileName,
                manuscriptFileName: manifest.manuscriptFileName,
                manuscriptText: manifest.manuscriptText,
                entries: [
                  { name: manifest.manuscriptFileName, kind: 'manuscript', content: 'zip.manuscriptText' },
                  ...manifest.images.map((im) => ({ name: im.fileName, kind: 'image', sourceUrl: im.url })),
                ],
              },
              saved: false,
              note:
                (slideUrls.length === 0 ? '카드 그림을 구하지 못해 이미지 없이 글만 돌려줍니다. ' : '') +
                (slideImageUrls ? '넘겨 받은 그림 주소를 그대로 썼습니다(새로 그리지 않음). ' : '') +
                'DB(blog_posts)에 저장하지 않았고 게시·예약도 하지 않았습니다.',
            },
            null,
            2
          )
        );
      }
    );

    // ── render_design ───────────────────────────────────────────────────
    server.registerTool(
      'render_design',
      {
        title: '카드뉴스 렌더',
        description: '저장된 디자인 id로 슬라이드를 서버에서 그려 공개 이미지 URL 목록을 반환합니다.',
        inputSchema: z.object({ designId: z.string().uuid() }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ designId }) => {
        // 원본: src/lib/cardnews/captureSlides.ts (captureDesignSlides) — 그대로 재사용.
        const shot = await captureDesignSlides(designId, 200_000);
        if (!shot.ok) return fail(`렌더 실패: ${shot.error}`);
        return ok(JSON.stringify({ designId, urls: shot.urls }, null, 2));
      }
    );

    // ── schedule_post ───────────────────────────────────────────────────
    server.registerTool(
      'schedule_post',
      {
        title: '인스타 발행 예약',
        description:
          '디자인의 이미지 URL(render_design으로 먼저 생성)과 캡션, 발행 시각(KST)으로 예약을 등록합니다. confirm:true가 없으면 무엇이 예약될지 미리보기만 반환하고 실행하지 않습니다.',
        inputSchema: z.object({
          designId: z.string().uuid().optional(),
          designName: z.string().optional(),
          // required로 두면 누락 시 MCP 스키마 검증 단계에서 일반 오류로 막혀
          // 아래의 "render_design 먼저 실행" 안내 메시지가 클라이언트에 닿지 않는다.
          // optional로 받고 핸들러 안에서 직접 안내한다.
          slideImageUrls: z.array(z.string().url()).min(1).optional(),
          caption: z.string().min(1),
          hashtags: z.string().optional(),
          scheduledAt: z.string().describe('KST 기준 일시. 예: 2026-09-30T10:00:00 (타임존 없으면 KST로 간주)'),
          confirm: z.boolean().optional(),
        }),
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      async ({ designId, designName, slideImageUrls, caption, hashtags, scheduledAt, confirm }) => {
        if (!slideImageUrls || slideImageUrls.length === 0) {
          return fail('slideImageUrls가 없습니다. render_design을 먼저 실행해 이미지 URL을 만드세요.');
        }

        const iso = toKstIso(scheduledAt);
        if (!iso) return fail(`scheduledAt을 해석하지 못했습니다: ${scheduledAt}`);
        if (new Date(iso).getTime() <= Date.now()) {
          return fail(`scheduledAt(${iso})이 현재보다 과거이거나 같습니다. 미래 시각을 지정하세요.`);
        }

        const preview = {
          designId,
          designName,
          thumbnailUrl: slideImageUrls[0],
          slideCount: slideImageUrls.length,
          caption,
          hashtags: hashtags || '',
          scheduledAt: iso,
        };

        if (!confirm) {
          return ok(JSON.stringify({ preview, note: 'confirm:true 없이 미리보기만 반환했습니다. 실제로 등록하려면 confirm:true로 다시 호출하세요.' }, null, 2));
        }

        // 원본: src/app/api/scheduled-posts/route.ts (POST) — insert 로직 그대로.
        const { data, error } = await supabase
          .from('scheduled_posts')
          .insert({
            design_id: designId ?? null,
            design_name: designName ?? null,
            thumbnail_url: slideImageUrls[0],
            slide_image_urls: slideImageUrls,
            caption,
            hashtags: hashtags ?? '',
            scheduled_at: iso,
            status: 'pending',
          })
          .select()
          .single();

        if (error) return fail(`예약 저장 실패: ${error.message}`);
        return ok(JSON.stringify({ postId: data.id, ...preview }, null, 2));
      }
    );

    // ── get_insights ────────────────────────────────────────────────────
    server.registerTool(
      'get_insights',
      {
        title: '성과 조회',
        description: '최근 발행된 게시물의 좋아요/조회수 등 성과 요약과 추천 발행 시간대를 조회합니다.',
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        // 원본: src/app/api/instagram/insights/route.ts (GET) — sns_accounts에서
        // access_token을 읽지만, 응답에는 절대 포함하지 않는다(아래 map에서 제외).
        const { data: settings } = await supabase
          .from('sns_accounts')
          .select('access_token, ig_user_id:platform_user_id')
          .eq('platform', 'instagram')
          .limit(1)
          .maybeSingle();

        let insights: unknown[] = [];
        if (settings?.access_token && settings?.ig_user_id) {
          const { data: posts } = await supabase
            .from('scheduled_posts')
            .select('id, design_name, thumbnail_url, caption, scheduled_at, ig_post_id')
            .eq('status', 'published')
            .not('ig_post_id', 'is', null)
            .order('scheduled_at', { ascending: false })
            .limit(20);

          insights = await Promise.all(
            (posts ?? []).map(async (post) => {
              try {
                const fields = 'like_count,comments_count,timestamp,permalink';
                const res = await fetch(
                  `${IG_API}/${post.ig_post_id}?fields=${fields}&access_token=${settings.access_token}`
                );
                const ig = await res.json();
                return {
                  id: post.id,
                  designName: post.design_name,
                  scheduledAt: post.scheduled_at,
                  permalink: ig.permalink ?? null,
                  likeCount: ig.like_count ?? 0,
                  commentsCount: ig.comments_count ?? 0,
                };
              } catch {
                return { id: post.id, designName: post.design_name, scheduledAt: post.scheduled_at, error: '조회 실패' };
              }
            })
          );
        }

        // 원본: src/app/api/insights/best-time/route.ts (GET) — 추천 시간대 계산 로직 그대로.
        const { data: publishedPosts } = await supabase
          .from('scheduled_posts')
          .select('scheduled_at, status')
          .eq('status', 'published')
          .not('scheduled_at', 'is', null);

        const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
        const hourBuckets: Record<string, number> = {};
        (publishedPosts ?? []).forEach((p) => {
          const hour = new Date(p.scheduled_at).getHours();
          hourBuckets[hour] = (hourBuckets[hour] || 0) + 1;
        });
        const bestSlots = Object.entries(hourBuckets)
          .map(([hour, count]) => ({ hour: parseInt(hour), label: `${hour.padStart(2, '0')}:00`, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return ok(
          JSON.stringify(
            { insights, bestSlots, totalPublished: publishedPosts?.length ?? 0, dayLabels: DAYS },
            null,
            2
          )
        );
      }
    );

    // ── lookup_apartment ────────────────────────────────────────────────
    server.registerTool(
      'lookup_apartment',
      {
        title: '아파트 실거래 조회',
        description: '지역(법정동코드)·기간·금액대로 아파트 실거래를 조회합니다.',
        inputSchema: z.object({
          lawdCd: z.string().describe('법정동 앞 5자리 코드'),
          months: z.number().int().min(1).max(12).optional(),
          minPrice: z.number().optional().describe('만원 단위'),
          maxPrice: z.number().optional().describe('만원 단위'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ lawdCd, months, minPrice, maxPrice }) => {
        // 원본: src/app/api/apt-list/lookup/route.ts (POST) — fetchMolitTrades/findSigungu 그대로.
        if (!findSigungu(lawdCd)) return fail('알 수 없는 지역 코드입니다.');

        const result = await fetchMolitTrades({
          lawdCd,
          months: months || 3,
          minPriceManwon: minPrice,
          maxPriceManwon: maxPrice,
        });

        if (!result.ok) return fail(result.error);
        return ok(JSON.stringify({ matched: result.records.length, records: result.records }, null, 2));
      }
    );
  },
  { serverInfo: { name: 'cardnews-mcp', version: '0.1.0' } }
);

function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

async function verifyToken(_req: Request, bearerToken?: string) {
  const secret = process.env.MCP_SECRET_TOKEN;
  if (!secret || !bearerToken) return undefined;
  const a = Buffer.from(bearerToken);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return undefined;
  if (!timingSafeEqual(a, b)) return undefined;
  return { token: bearerToken, clientId: 'owner', scopes: [] };
}

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST };
