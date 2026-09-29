import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { toKoreanError } from '@/lib/gemini';
import { callAI } from '@/lib/ai/openrouter';
import { extractArticle } from '@/lib/extractArticle';
import { buildDraftPages } from '@/lib/mcp/buildDraftPages';
import { captureDesignSlides } from '@/lib/cardnews/captureSlides';
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
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ topic, url, slideCount, tone, outputLanguage }) => {
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
${sourceFidelityBlock}${languageInstruction}
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
          const pagesData = buildDraftPages(data.cardNews);

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
