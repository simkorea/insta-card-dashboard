'use client';

import { useRef, useState } from 'react';
import { Send, Loader2, Check } from 'lucide-react';
import type { SlideBlock } from '@/lib/cardnews/blocks';
import { HybridRenderer } from './HybridRenderer';
import { NewspaperRenderer } from './NewspaperRenderer';
import { loadCaption } from '@/lib/cardnews/captionStore';
import { buildVideoCaption } from '@/lib/cardnews/videoMeta';

// 보관함에서 카드뉴스를 바로 인스타그램에 올린다.
//
// 왜 만들었나: 만든 카드뉴스 81개 중 실제로 올라간 건 4건이었다. 만드는 건
// 자동화됐는데 올리는 길이 '보관함 → 편집기 열기 → 캡처 → 업로드'로 멀어서,
// 최근 2주에만 37개가 쌓여 있었다. 만드는 기능을 더 붙이는 것보다 이 길을
// 줄이는 게 먼저다.
//
// 하는 일: 카드를 화면 밖에 그려 캡처 → 저장소에 올려 공개 URL 확보 →
// 인스타 발행. 인스타 API는 공개 URL만 받으므로 캡처본을 반드시 올려야 한다.

type PageLike = {
  id?: string | number;
  blocks?: SlideBlock[];
  bgImage?: string;
  styleVariant?: string;
  noteLabel?: string;
  noteNumber?: string;
  title?: string;
};

// 인스타 권장 해상도. 420px 기준 캔버스를 2.6배로 뽑으면 1092px이 된다.
const CAPTURE_SCALE = 2.6;

export function PublishButton({
  designId,
  designName,
  pages,
  onDone,
  className = '',
}: {
  designId: string;
  designName: string;
  pages: PageLike[];
  onDone?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState(false);
  const [staging, setStaging] = useState(false);
  const refs = useRef<Record<number, HTMLDivElement | null>>({});

  const hybridPages = pages
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.bgImage?.trim());

  const run = async () => {
    if (busy) return;
    const caption =
      loadCaption(designId) || buildVideoCaption(pages as any, designName);

    if (!confirm(`인스타그램에 ${pages.length}장을 올립니다.\n\n캡션:\n${caption.slice(0, 160)}${caption.length > 160 ? '…' : ''}\n\n올릴까요?`)) return;

    setBusy('카드 그리는 중…');
    try {
      // 그림 파일이 없는 장(노트·신문)은 화면 밖에 그려서 캡처한다
      if (hybridPages.length > 0) {
        setStaging(true);
        await new Promise(r => setTimeout(r, 500));
        await document.fonts?.ready;
        await new Promise(r => setTimeout(r, 500));
      }

      const { toBlob } = await import('html-to-image');
      const urls: string[] = [];

      for (let i = 0; i < pages.length; i++) {
        setBusy(`올리는 중… (${i + 1}/${pages.length})`);
        const stored = pages[i].bgImage;
        if (stored && stored.startsWith('http')) { urls.push(stored); continue; }

        const el = refs.current[i];
        if (!el) throw new Error(`${i + 1}번째 장을 그리지 못했습니다.`);
        const blob = await toBlob(el, { pixelRatio: 1, cacheBust: false, skipFonts: false, type: 'image/jpeg', quality: 0.92 });
        if (!blob) throw new Error(`${i + 1}번째 장 캡처에 실패했습니다.`);

        const form = new FormData();
        form.append('file', new File([blob], `card_${i + 1}.jpg`, { type: 'image/jpeg' }));
        const upRes = await fetch('/api/upload-image', { method: 'POST', body: form });
        const up = await upRes.json();
        // 인스타는 공개 URL만 받는다 — data URL 폴백은 여기서 쓸 수 없다
        if (!up.url || !String(up.url).startsWith('http')) {
          throw new Error(up.error || '이미지 업로드에 실패했습니다. (저장소 설정 확인 필요)');
        }
        urls.push(up.url);
      }

      setStaging(false);
      setBusy('인스타그램에 올리는 중…');
      const pubRes = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: urls, caption }),
      });
      const pub = await pubRes.json();
      if (!pubRes.ok || pub.error) throw new Error(pub.error || '발행에 실패했습니다.');

      setDone(true);
      onDone?.();
      alert('인스타그램에 올렸습니다.');
    } catch (e: any) {
      alert(e?.message || '발행 중 오류가 발생했습니다.');
    } finally {
      setStaging(false);
      setBusy('');
    }
  };

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); run(); }}
        disabled={Boolean(busy) || done}
        className={`inline-flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        {done
          ? <><Check size={13} /> 올림</>
          : busy
            ? <><Loader2 size={13} className="animate-spin" /> {busy}</>
            : <><Send size={13} /> 바로 발행</>}
      </button>

      {/* 캡처용 화면 밖 영역 — 420×525 기준으로 그린 뒤 배율만 올려 뽑는다 */}
      {staging && (
        <div style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none', zIndex: -1 }}>
          {hybridPages.map(({ p, i }) => (
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
