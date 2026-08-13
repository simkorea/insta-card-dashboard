'use client';

import { useRef, useState } from 'react';
import { CalendarClock, Loader2, X } from 'lucide-react';
import type { SlideBlock } from '@/lib/cardnews/blocks';
import { HybridRenderer } from './HybridRenderer';
import { NewspaperRenderer } from './NewspaperRenderer';
import { loadCaption } from '@/lib/cardnews/captionStore';
import { buildVideoCaption } from '@/lib/cardnews/videoMeta';

// 고른 카드뉴스를 며칠에 걸쳐 줄 세워 예약한다.
//
// 왜 다섯 개까지인가: 예약 시각에는 그림이 이미 있어야 한다. 크론에는
// 브라우저가 없어 카드를 그릴 수 없기 때문이다. 그래서 예약을 누르는 지금
// 여기서 캡처해 올려야 하는데, 카드 한 벌이 7~10장이라 다섯 벌이면 이미
// 50장 가까이 된다. 그 이상은 한 번에 감당하기 어렵다.

type PageLike = {
  blocks?: SlideBlock[];
  bgImage?: string;
  styleVariant?: string;
  noteLabel?: string;
  noteNumber?: string;
};
type Design = { id: string; name: string; pages_data: PageLike[] };

const CAPTURE_SCALE = 2.6;   // 420px 기준 → 1092px (인스타 권장 해상도)
export const MAX_BULK = 5;

/** 로컬 시각을 datetime-local 입력이 읽는 형식으로 */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function BulkScheduleBar({
  designs,
  onClear,
  onDone,
}: {
  designs: Design[];
  onClear: () => void;
  onDone: () => void;
}) {
  // 기본값: 내일 오전 9시부터 하루에 하나씩
  const [startAt, setStartAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalInput(d);
  });
  const [gapHours, setGapHours] = useState(24);
  const [busy, setBusy] = useState('');
  const [stage, setStage] = useState<Design | null>(null);
  const refs = useRef<Record<number, HTMLDivElement | null>>({});

  const capture = async (d: Design): Promise<string[]> => {
    const pages = d.pages_data || [];
    const needs = pages.some(p => !p.bgImage?.trim());
    if (needs) {
      setStage(d);
      await new Promise(r => setTimeout(r, 500));
      await document.fonts?.ready;
      await new Promise(r => setTimeout(r, 400));
    }
    const { toBlob } = await import('html-to-image');
    const urls: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      const stored = pages[i].bgImage;
      if (stored && stored.startsWith('http')) { urls.push(stored); continue; }
      const el = refs.current[i];
      if (!el) throw new Error(`'${d.name}' ${i + 1}번째 장을 그리지 못했습니다.`);
      const blob = await toBlob(el, { pixelRatio: 1, cacheBust: false, skipFonts: false, type: 'image/jpeg', quality: 0.92 });
      if (!blob) throw new Error(`'${d.name}' ${i + 1}번째 장 캡처에 실패했습니다.`);
      const form = new FormData();
      form.append('file', new File([blob], `c${i + 1}.jpg`, { type: 'image/jpeg' }));
      const r = await fetch('/api/upload-image', { method: 'POST', body: form });
      const j = await r.json();
      // 인스타는 공개 URL만 받는다 — data URL 폴백은 예약 시각에 조용히 실패한다
      if (!j.url || !String(j.url).startsWith('http')) {
        throw new Error(j.error || '이미지 업로드에 실패했습니다.');
      }
      urls.push(j.url);
    }
    setStage(null);
    return urls;
  };

  const run = async () => {
    if (busy) return;
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) { alert('시작 시각을 확인해주세요.'); return; }
    if (start.getTime() < Date.now()) { alert('시작 시각이 이미 지났습니다.'); return; }

    const when = (i: number) => new Date(start.getTime() + i * gapHours * 3600 * 1000);
    const plan = designs.map((d, i) => `· ${when(i).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}  ${d.name}`).join('\n');
    if (!confirm(`${designs.length}개를 예약합니다.\n\n${plan}\n\n진행할까요? 카드를 그려 올리는 동안 이 창을 닫지 마세요.`)) return;

    setBusy('준비 중…');
    try {
      const items = [];
      for (let i = 0; i < designs.length; i++) {
        const d = designs[i];
        setBusy(`카드 올리는 중… (${i + 1}/${designs.length})`);
        const imageUrls = await capture(d);
        items.push({
          designId: d.id,
          designName: d.name,
          imageUrls,
          caption: loadCaption(d.id) || buildVideoCaption(d.pages_data as any, d.name),
          scheduledAt: when(i).toISOString(),
        });
      }

      setBusy('예약하는 중…');
      const res = await fetch('/api/scheduled-posts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '예약에 실패했습니다.');

      alert(`${json.count}개를 예약했습니다. 캘린더에서 확인할 수 있습니다.`);
      onDone();
    } catch (e: any) {
      alert(e?.message || '예약 중 오류가 발생했습니다.');
    } finally {
      setStage(null);
      setBusy('');
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-black text-gray-900 shrink-0">
            {designs.length}개 선택
            <span className="text-[11px] font-medium text-gray-400 ml-1">/ 최대 {MAX_BULK}개</span>
          </span>

          <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
            시작
            <input
              type="datetime-local"
              value={startAt}
              onChange={e => setStartAt(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-[11px] outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>

          <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
            간격
            <select
              value={gapHours}
              onChange={e => setGapHours(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1 text-[11px] outline-none"
            >
              <option value={24}>하루에 하나</option>
              <option value={12}>12시간</option>
              <option value={6}>6시간</option>
              <option value={0}>동시에</option>
            </select>
          </label>

          <div className="flex-1" />

          <button
            onClick={onClear}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-1 px-3 py-2 text-[11px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <X size={12} /> 선택 해제
          </button>
          <button
            onClick={run}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary-600 text-white text-xs font-bold rounded-xl hover:bg-primary-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {busy
              ? <><Loader2 size={13} className="animate-spin" /> {busy}</>
              : <><CalendarClock size={13} /> 예약하기</>}
          </button>
        </div>
      </div>

      {/* 캡처용 화면 밖 영역 — 한 벌씩 올려 그린다 */}
      {stage && (
        <div style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none', zIndex: -1 }}>
          {(stage.pages_data || []).map((p, i) => (
            <div
              key={i}
              ref={el => { refs.current[i] = el; }}
              style={{ width: 420 * CAPTURE_SCALE, height: 525 * CAPTURE_SCALE, position: 'relative', overflow: 'hidden' }}
            >
              {p.styleVariant === 'hybridPaper' ? (
                <NewspaperRenderer blocks={p.blocks || []} scale={CAPTURE_SCALE} index={i} noteLabel={p.noteLabel} noteNumber={p.noteNumber} />
              ) : (
                <HybridRenderer blocks={p.blocks || []} scale={CAPTURE_SCALE} index={i} noteLabel={p.noteLabel} noteNumber={p.noteNumber} />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
