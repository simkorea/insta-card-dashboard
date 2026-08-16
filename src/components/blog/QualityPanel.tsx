'use client';
import { useState } from 'react';
import { ShieldCheck, Loader2, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

// 발행 전 원고 품질 점검 패널.
//
// 점수 자체보다 '왜 그 점수인지'와 '무엇부터 고칠지'가 핵심이라,
// 큰 숫자보다 항목별 근거와 우선순위에 자리를 더 준다.

type Item = { id: string; label: string; score: number; max: number; why: string; by: 'code' | 'ai' };
type Area = { id: string; label: string; items: Item[] };
type Axis = { id: string; label: string; desc: string; score: number; got: number; max: number; areas: Area[] };
type Priority = { id: string; axis: string; area: string; label: string; score: number; max: number; why: string };

export type QualityResult = {
  total: number;
  axes: Axis[];
  priorities: Priority[];
  targetKeyword: string;
  itemCount: number;
  model: string;
  rubricVersion: string;
  contentHash: string;
};

type HistoryRow = {
  id: string; total_score: number; seo_score: number; aeo_score: number; geo_score: number;
  content_hash: string; rubric_version: string; created_at: string;
};

const AXIS_TONE: Record<string, string> = {
  seo: 'bg-sky-50 border-sky-200 text-sky-800',
  aeo: 'bg-violet-50 border-violet-200 text-violet-800',
  geo: 'bg-emerald-50 border-emerald-200 text-emerald-800',
};

const barColor = (ratio: number) =>
  ratio >= 0.8 ? 'bg-emerald-500' : ratio >= 0.6 ? 'bg-amber-500' : 'bg-rose-500';

export default function QualityPanel({
  title, body, tags, images, draftKey, blogPostId,
}: {
  title: string; body: string; tags: string[];
  images: { url?: string; label?: string }[];
  draftKey: string; blogPostId: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<QualityResult | null>(null);
  const [prev, setPrev] = useState<HistoryRow | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [keyword, setKeyword] = useState('');

  const run = async () => {
    if (!body?.trim()) return;
    setBusy(true); setError('');
    try {
      // 채점 직전의 이전 기록을 먼저 받아 둔다 (전후 비교용)
      let before: HistoryRow | null = null;
      try {
        const q = blogPostId ? `blogPostId=${blogPostId}` : `draftKey=${encodeURIComponent(draftKey)}`;
        const h = await fetch(`/api/analyze/blog-quality?${q}`).then(r => r.json());
        before = (h.history ?? [])[0] ?? null;
      } catch { /* 이력은 없어도 채점은 된다 */ }

      const res = await fetch('/api/analyze/blog-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, tags, images, draftKey, blogPostId, targetKeyword: keyword.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '채점에 실패했습니다.');
      setPrev(before);
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '채점 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const delta = (now: number, was: number | undefined) => {
    if (was === undefined || was === null) return null;
    const d = now - was;
    if (d === 0) return <span className="text-[11px] text-gray-400 ml-1">±0</span>;
    return (
      <span className={`text-[11px] ml-1 font-bold ${d > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
        {d > 0 ? '▲' : '▼'}{Math.abs(d)}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-primary-500" />
          <p className="text-xs font-bold text-gray-400 uppercase">발행 전 품질 점검</p>
        </div>
        <button
          onClick={run}
          disabled={busy || !body?.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
          {busy ? '채점 중...' : result ? '다시 점검' : '점검하기'}
        </button>
      </div>

      {/* 과장 금지 — 이 문구는 지우지 말 것 */}
      <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
        구조 진단 지표이며 검색 노출 순위를 보장하지 않습니다. 원고가 검색·질문답변·AI 인용에
        적합한 형태를 갖췄는지만 봅니다.
      </p>

      <div className="flex items-center gap-2 mb-3">
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="목표 검색어 (비우면 제목에서 자동 추정)"
          className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-primary-400"
        />
      </div>

      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">{error}</div>
      )}

      {result && (
        <div className="space-y-4">
          {/* 종합 + 축별 */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-[19px] font-black text-gray-900 leading-none">
                {result.total}
                {delta(result.total, prev?.total_score)}
              </div>
              <div className="text-[10px] font-bold text-gray-500 mt-1">종합</div>
            </div>
            {result.axes.map(ax => {
              const was = prev ? ({ seo: prev.seo_score, aeo: prev.aeo_score, geo: prev.geo_score }[ax.id]) : undefined;
              return (
                <div key={ax.id} className={`rounded-xl border p-3 ${AXIS_TONE[ax.id] ?? 'bg-gray-50 border-gray-200'}`} title={ax.desc}>
                  <div className="text-[19px] font-black leading-none">
                    {ax.score}
                    {delta(ax.score, was)}
                  </div>
                  <div className="text-[10px] font-bold mt-1">{ax.label}</div>
                </div>
              );
            })}
          </div>
          {prev && (
            <p className="text-[10px] text-gray-400">
              이전 채점({new Date(prev.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})과 비교했습니다.
              {prev.rubric_version !== result.rubricVersion && ' ⚠️ 그 사이 채점 기준이 바뀌어 그대로 비교하기 어렵습니다.'}
            </p>
          )}

          {/* 먼저 고칠 순서 */}
          {result.priorities.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-xs font-bold text-amber-900 mb-2">먼저 고칠 순서</p>
              <ol className="space-y-1.5">
                {result.priorities.map((p, i) => (
                  <li key={p.id} className="flex items-start gap-2 text-[11px]">
                    <span className="shrink-0 w-4 h-4 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-[9px] mt-0.5">
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="font-bold text-gray-800">{p.area} · {p.label}</span>
                      <span className="text-amber-800/80"> — {p.why}</span>
                    </span>
                    <span className="shrink-0 text-[10px] font-bold text-amber-700">{p.score}/{p.max}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 축별 상세 */}
          <div className="space-y-2">
            {result.axes.map(ax => (
              <div key={ax.id} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpen(o => ({ ...o, [ax.id]: !o[ax.id] }))}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-200 transition-colors"
                >
                  <span className="text-xs font-bold text-gray-800 w-9 text-left">{ax.label}</span>
                  <span className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <span className={`block h-full rounded-full ${barColor(ax.score / 100)}`} style={{ width: `${ax.score}%` }} />
                  </span>
                  <span className="text-[11px] text-gray-500 tabular-nums">{ax.got}/{ax.max}</span>
                  {open[ax.id] ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
                </button>

                {open[ax.id] && (
                  <div className="px-4 pb-3 pt-1 space-y-3 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400">{ax.desc}</p>
                    {ax.areas.map(ar => (
                      <div key={ar.id}>
                        <p className="text-[11px] font-bold text-gray-600 mb-1">{ar.label}</p>
                        <ul className="space-y-1">
                          {ar.items.map(it => (
                            <li key={it.id} className="flex items-start gap-2 text-[11px]">
                              <span className={`shrink-0 w-7 text-center font-bold tabular-nums ${
                                it.score >= 4 ? 'text-emerald-600' : it.score >= 3 ? 'text-amber-600' : 'text-rose-600'
                              }`}>{it.score}/{it.max}</span>
                              <span className="flex-1 min-w-0">
                                <span className="text-gray-700">{it.label}</span>
                                <span className="text-gray-400"> — {it.why}</span>
                                {it.by === 'code' && (
                                  <span className="ml-1 text-[9px] text-gray-400 border border-gray-200 rounded px-1">직접 계측</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-[10px] text-gray-400 flex items-center gap-1 flex-wrap">
            <ArrowRight size={9} />
            목표 검색어 &ldquo;{result.targetKeyword || '미지정'}&rdquo; 기준 · {result.itemCount}개 항목 ·
            채점 기준 {result.rubricVersion} · {result.model.split('/')[1]}
          </p>
        </div>
      )}
    </div>
  );
}
