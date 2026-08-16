import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { callOpenRouter } from '@/lib/ai/openrouter';
import { toKoreanError } from '@/lib/gemini';
import { extractJson } from '@/lib/blog/extractJson';
import {
  AXES, ALL_ITEMS, LLM_ITEMS, AUTO_ITEMS, MAX_PER_ITEM,
  RUBRIC_VERSION, aggregate, measureDoc, buildScoringPrompt, type QualityDoc,
} from '@/lib/blog/qualityRubric';

// 발행 전 원고 품질 채점.
//
// ⚠️ 이 점수는 구조 진단이지 검색 순위 예측이 아니다. UI 문구도 그렇게 맞춰
// 두었으니, 나중에 '순위 예측' 같은 표현으로 바꾸지 말 것.
//
// 모델을 고정하는 이유:
// 같은 원고를 3번 채점해 비교해 봤더니 이렇게 갈렸다.
//   deepseek-v4-flash  합계 14 / 20 / 0     (전 항목 흔들림)
//   claude-haiku-4.5   합계 18 / 18 / 18    (항목별까지 동일)
// 59항목 규모로도 haiku 는 3회 모두 같은 점수였다. 점수가 흔들리면 원고를
// 고쳐서 오른 건지 운이 좋아 오른 건지 알 수 없어 기능 자체가 성립하지 않는다.
// callOpenRouter 의 기본 모델(deepseek)을 쓰면 안 되는 이유가 이것이다.
const SCORING_MODEL = 'anthropic/claude-haiku-4.5';

export const maxDuration = 120;

const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

type ScoredItem = {
  id: string; label: string; axis: string; area: string; areaLabel: string;
  score: number; max: number; why: string; by: 'code' | 'ai';
};

/**
 * 목표 검색어가 비었을 때 제목에서 뽑아 쓴다. AI를 한 번 더 부르지 않는다.
 *
 * 낱말 하나씩만 보면 "전세 계약 전 확인할 위험 신호" 에서 "전세" 가 잡힌다.
 * 실제로 검색하는 말은 두 낱말짜리가 많아, 붙어 있는 두 낱말을 먼저 본다.
 */
function guessKeyword(title: string, body: string): string {
  const cleaned = (title || '').replace(/[[\]()<>|:,.·—-]/g, ' ');
  const words = cleaned.split(/\s+/).filter(w => w.length >= 2 && !/^\d+$/.test(w));
  if (words.length === 0) return '';

  const countIn = (s: string) => body.split(s).length - 1;

  // 1) 붙어 있는 두 낱말이 본문에 2번 이상 나오면 그걸 쓴다
  let bestPair = '', bestPairCount = 1;
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]} ${words[i + 1]}`;
    const n = countIn(pair);
    if (n > bestPairCount) { bestPair = pair; bestPairCount = n; }
  }
  if (bestPair) return bestPair;

  // 2) 아니면 본문에 가장 자주 나오는 낱말 하나
  let best = words[0], bestCount = -1;
  for (const w of words) {
    const n = countIn(w);
    if (n > bestCount) { best = w; bestCount = n; }
  }
  return best;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title: string = String(body?.title ?? '').trim();
    const content: string = String(body?.body ?? '').trim();
    if (!content) {
      return NextResponse.json({ error: '채점할 본문이 필요합니다.' }, { status: 400 });
    }

    const doc: QualityDoc = {
      title,
      body: content,
      tags: Array.isArray(body?.tags) ? body.tags.map(String) : [],
      images: Array.isArray(body?.images) ? body.images : [],
      targetKeyword: String(body?.targetKeyword ?? '').trim() || guessKeyword(title, content),
    };

    const metrics = measureDoc(doc);

    // ── 1. 코드가 셀 수 있는 항목 ─────────────────────────────────────────
    // 글자 수·소제목 개수 같은 건 세면 되는 값이라 AI에게 묻지 않는다.
    // 항상 같은 답이 나오고, 그만큼 AI가 판단할 항목도 줄어든다.
    const scored: ScoredItem[] = [];
    for (const it of AUTO_ITEMS) {
      const r = it.measure!(doc, metrics);
      scored.push({
        id: it.id, label: it.label, axis: it.axis, area: it.area, areaLabel: it.areaLabel,
        score: Math.max(0, Math.min(MAX_PER_ITEM, r.score)), max: MAX_PER_ITEM, why: r.why, by: 'code',
      });
    }

    // ── 2. 판단이 필요한 항목만 AI에게 ────────────────────────────────────
    // 프롬프트는 루브릭 파일에 있다. 문구도 점수에 영향을 주므로 항목·버전과
    // 같은 자리에 두어야 기준이 바뀐 걸 추적할 수 있다.
    const raw = await callOpenRouter({
      model: SCORING_MODEL,
      prompt: buildScoringPrompt(doc),
      temperature: 0,   // 같은 원고 → 같은 점수
      maxTokens: 8000,
      jsonMode: true,
    });

    const parsed = extractJson<{ items?: { id?: string; score?: number; why?: string }[] }>(raw);
    const byId = new Map((parsed.items ?? []).map(i => [String(i.id), i]));

    const missing: string[] = [];
    for (const it of LLM_ITEMS) {
      const got = byId.get(it.id);
      if (!got || typeof got.score !== 'number') {
        missing.push(it.id);
        continue;
      }
      scored.push({
        id: it.id, label: it.label, axis: it.axis, area: it.area, areaLabel: it.areaLabel,
        score: Math.max(0, Math.min(MAX_PER_ITEM, Math.round(got.score))), max: MAX_PER_ITEM,
        why: String(got.why ?? '').slice(0, 80), by: 'ai',
      });
    }

    // 일부만 돌려주면 총점이 조용히 낮아진다. 그건 원고 문제가 아니므로 막는다.
    if (missing.length > LLM_ITEMS.length * 0.2) {
      return NextResponse.json(
        { error: `채점이 완료되지 않았습니다 (${LLM_ITEMS.length}개 중 ${missing.length}개 누락). 다시 시도해주세요.` },
        { status: 502 },
      );
    }
    // 소수가 빠진 건 해당 항목만 제외하고 진행 — 빠진 항목은 만점 기준에서도 뺀다
    const answeredIds = new Set(scored.map(s => s.id));

    // ── 3. 합산은 코드가 한다 ─────────────────────────────────────────────
    const scoreMap: Record<string, number> = {};
    for (const s of scored) scoreMap[s.id] = s.score;
    const { perAxis, total } = aggregate(scoreMap);

    // ── 4. 먼저 고칠 순서 ────────────────────────────────────────────────
    // 점수가 낮을수록, 그리고 만점과의 차이가 클수록 먼저다.
    const priorities = scored
      .filter(s => s.score < MAX_PER_ITEM)
      .sort((a, b) => a.score - b.score || a.axis.localeCompare(b.axis))
      .slice(0, 8)
      .map(s => ({
        id: s.id, axis: s.axis, area: s.areaLabel, label: s.label,
        score: s.score, max: s.max, why: s.why,
      }));

    const contentHash = createHash('sha1').update(`${title}\n${content}`).digest('hex').slice(0, 16);

    const result = {
      total,
      axes: AXES.map(ax => ({
        id: ax.id, label: ax.label, desc: ax.desc,
        score: perAxis[ax.id].score, got: perAxis[ax.id].got, max: perAxis[ax.id].max,
        areas: ax.areas.map(ar => ({
          id: ar.id, label: ar.label,
          items: scored.filter(s => s.area === ar.id && s.axis === ax.id),
        })).filter(ar => ar.items.length > 0),
      })),
      priorities,
      targetKeyword: doc.targetKeyword,
      itemCount: scored.length,
      skipped: missing,
      model: SCORING_MODEL,
      rubricVersion: RUBRIC_VERSION,
      contentHash,
      measuredAt: new Date().toISOString(),
    };

    // ── 5. 이력 저장 (실패해도 채점 결과는 돌려준다) ──────────────────────
    let historyId: string | null = null;
    const draftKey = String(body?.draftKey ?? '').trim();
    if (supabaseService && draftKey) {
      const { data, error } = await supabaseService
        .from('blog_quality_scores')
        .insert({
          blog_post_id: body?.blogPostId || null,
          draft_key: draftKey,
          title: title || null,
          content_hash: contentHash,
          seo_score: perAxis.seo.score,
          aeo_score: perAxis.aeo.score,
          geo_score: perAxis.geo.score,
          total_score: total,
          items: scored,
          priorities,
          target_keyword: doc.targetKeyword || null,
          model: SCORING_MODEL,
          rubric_version: RUBRIC_VERSION,
        })
        .select('id')
        .maybeSingle();
      if (error) console.warn('[blog-quality] 이력 저장 실패:', error.message);
      else historyId = data?.id ?? null;
    }

    return NextResponse.json({ ...result, historyId, itemsTotal: ALL_ITEMS.length, answered: answeredIds.size });
  } catch (e: unknown) {
    return NextResponse.json({ error: toKoreanError(e) }, { status: 500 });
  }
}

/** 이전 채점 이력 (전후 비교용) */
export async function GET(request: NextRequest) {
  try {
    if (!supabaseService) return NextResponse.json({ history: [] });
    const url = new URL(request.url);
    const draftKey = url.searchParams.get('draftKey');
    const blogPostId = url.searchParams.get('blogPostId');
    if (!draftKey && !blogPostId) return NextResponse.json({ history: [] });

    let q = supabaseService
      .from('blog_quality_scores')
      .select('id, total_score, seo_score, aeo_score, geo_score, content_hash, rubric_version, model, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    q = blogPostId ? q.eq('blog_post_id', blogPostId) : q.eq('draft_key', draftKey!);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ history: data ?? [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: toKoreanError(e) }, { status: 500 });
  }
}
