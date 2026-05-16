'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TextStyle {
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
  letterSpacing?: number;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
}

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;900' +
  '&family=Nanum+Gothic:wght@400;700;800' +
  '&family=Black+Han+Sans' +
  '&family=Gothic+A1:wght@300;400;500;600;700;900' +
  '&family=Nanum+Myeongjo:wght@400;700;800' +
  '&family=Do+Hyeon' +
  '&family=Jua' +
  '&family=Gowun+Dodum' +
  '&display=swap';
interface PageData {
  id: number;
  bgImage: string;
  overlay: string;
  title: string;
  subtitle?: string;
  accent?: string;
  layout: 'center' | 'bottom-left' | 'bottom-left-list';
  bullets?: string[];
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  bulletStyle?: TextStyle;
}

// ─── Slide Renderer ──────────────────────────────────────────────────────────
function Slide({ page, width }: { page: PageData; width: number }) {
  const s = width / 420;
  useEffect(() => {
    if (document.getElementById('gf-view')) return;
    const link = document.createElement('link');
    link.id = 'gf-view';
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
  }, []);
  return (
    <div
      className="relative overflow-hidden flex-shrink-0 rounded-xl shadow-2xl"
      style={{ width, height: width * (5 / 4) }}
    >
      <img src={page.bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: page.overlay }} />

      <div className="absolute inset-0 pointer-events-none">
        {page.layout === 'center' && (
          <div className="flex flex-col items-center justify-center h-full px-10 text-center">
            <h1
              className="drop-shadow-lg whitespace-pre-line"
              style={{
                fontSize: `${(page.titleStyle?.fontSize ?? 38) * s}px`,
                fontWeight: page.titleStyle?.fontWeight ?? '900',
                fontFamily: page.titleStyle?.fontFamily ?? 'Noto Sans KR',
                color: page.titleStyle?.color ?? '#FFFFFF',
                lineHeight: page.titleStyle?.lineHeight ?? 1.2,
                letterSpacing: page.titleStyle?.letterSpacing ? `${page.titleStyle.letterSpacing * s}px` : undefined,
                textAlign: page.titleStyle?.align ?? 'center',
              }}
            >
              {page.title}
            </h1>
            <div className="bg-white/50 my-4" style={{ width: 64 * s, height: 2 }} />
            {page.subtitle && (
              <p
                className="whitespace-pre-line drop-shadow"
                style={{
                  fontSize: `${(page.subtitleStyle?.fontSize ?? 14) * s}px`,
                  fontWeight: page.subtitleStyle?.fontWeight ?? '400',
                  fontFamily: page.subtitleStyle?.fontFamily ?? page.titleStyle?.fontFamily ?? 'Noto Sans KR',
                  color: page.subtitleStyle?.color ?? '#E5E7EB',
                  lineHeight: page.subtitleStyle?.lineHeight ?? 1.6,
                  textAlign: page.subtitleStyle?.align ?? 'center',
                }}
              >
                {page.subtitle}
              </p>
            )}
          </div>
        )}

        {(page.layout === 'bottom-left' || page.layout === 'bottom-left-list') && (
          <div className="flex flex-col justify-end h-full" style={{ padding: `0 ${32 * s}px ${40 * s}px`, gap: 20 * s }}>
            <div className="flex items-start" style={{ gap: 12 * s }}>
              <span style={{ color: page.accent || '#ffd700', fontSize: `${(page.titleStyle?.fontSize ?? 24) * s}px`, marginTop: 2 * s }}>●</span>
              <h2
                style={{
                  fontSize: `${(page.titleStyle?.fontSize ?? 24) * s}px`,
                  fontWeight: page.titleStyle?.fontWeight ?? '900',
                  fontFamily: page.titleStyle?.fontFamily ?? 'Noto Sans KR',
                  color: page.titleStyle?.color ?? (page.accent || '#ffd700'),
                  lineHeight: page.titleStyle?.lineHeight ?? 1.2,
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(255,215,0,0.5)',
                }}
              >
                {page.title}
              </h2>
            </div>
            {page.bullets && (
              <div style={{ paddingLeft: 8 * s, display: 'flex', flexDirection: 'column', gap: 10 * s }}>
                {page.bullets.map((b, i) => (
                  <div key={i} className="flex items-start" style={{ gap: 8 * s }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: `${(page.bulletStyle?.fontSize ?? 14) * s}px`, marginTop: 2 * s }}>•</span>
                    <p
                      style={{
                        fontSize: `${(page.bulletStyle?.fontSize ?? 14) * s}px`,
                        fontWeight: page.bulletStyle?.fontWeight ?? '400',
                        fontFamily: page.bulletStyle?.fontFamily ?? page.titleStyle?.fontFamily ?? 'Noto Sans KR',
                        color: page.bulletStyle?.color ?? '#FFFFFF',
                        lineHeight: page.bulletStyle?.lineHeight ?? 1.6,
                      }}
                      dangerouslySetInnerHTML={{ __html: b.replace(/<b>(.*?)<\/b>/g, `<b style="color:${page.accent || '#ffd700'}">$1</b>`) }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Viewer Page ─────────────────────────────────────────────────────────
export default function ViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [design, setDesign] = useState<{ name: string; pages_data: PageData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(0);
  const [copied, setCopied] = useState(false);
  const [slideW, setSlideW] = useState(320);
  const touchStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/designs/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.design) {
          setDesign({ name: d.design.name, pages_data: d.design.pages_data });
        } else {
          setError('카드뉴스를 찾을 수 없습니다.');
        }
      })
      .catch(() => setError('불러오기 실패'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxW = Math.min(vw - 32, 420);
      const maxByH = (vh - 160) * (4 / 5);
      setSlideW(Math.floor(Math.min(maxW, maxByH)));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  const total = design?.pages_data.length ?? 0;
  const prev = useCallback(() => setCurrent(c => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent(c => Math.min(total - 1, c + 1)), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') router.push('/cardnews');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, router]);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">카드뉴스를 불러오는 중...</p>
      </div>
    </div>
  );

  if (error || !design) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center px-6">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-white text-lg font-bold mb-2">{error || '카드뉴스를 찾을 수 없습니다'}</p>
        <p className="text-white/40 text-sm mb-6">링크가 만료되었거나 삭제된 카드뉴스입니다.</p>
        <Link href="/cardnews" className="px-5 py-2.5 bg-white text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors">
          카드뉴스 만들기
        </Link>
      </div>
    </div>
  );

  const page = design.pages_data[current];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col select-none" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link href="/cardnews" className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <div>
            <p className="text-white text-sm font-bold truncate max-w-[180px]">{design.name}</p>
            <p className="text-white/40 text-[11px]">{total}장 카드뉴스</p>
          </div>
        </div>
        <button
          onClick={handleCopyLink}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${copied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'}`}
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              복사됨!
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              링크 복사
            </>
          )}
        </button>
      </div>

      {/* Viewer */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
        {/* Slide */}
        <div
          className="relative"
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const diff = touchStartX.current - e.changedTouches[0].clientX;
            if (diff > 40) next();
            else if (diff < -40) prev();
          }}
        >
          {page && <Slide page={page} width={slideW} />}

          {/* Prev / Next arrows */}
          {current > 0 && (
            <button
              onClick={prev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 w-10 h-10 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center transition-colors hidden sm:flex"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          {current < total - 1 && (
            <button
              onClick={next}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 w-10 h-10 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center transition-colors hidden sm:flex"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )}
        </div>

        {/* Page counter */}
        <div className="flex items-center gap-1">
          <span className="text-white/60 text-sm font-medium">{current + 1}</span>
          <span className="text-white/30 text-sm">/</span>
          <span className="text-white/40 text-sm">{total}</span>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {design.pages_data.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`transition-all rounded-full ${i === current ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/30 hover:bg-white/50'}`}
            />
          ))}
        </div>

        {/* Thumbnail strip */}
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-full px-4">
          {design.pages_data.map((pg, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`flex-shrink-0 rounded-lg overflow-hidden transition-all ${i === current ? 'ring-2 ring-white scale-105' : 'opacity-50 hover:opacity-80'}`}
              style={{ width: 48, height: 60 }}
            >
              <div className="relative w-full h-full">
                <img src={pg.bgImage} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: pg.overlay }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-4 flex items-center justify-between">
        <p className="text-white/30 text-[11px]">← → 키보드 또는 스와이프로 이동</p>
        <Link
          href="/cardnews"
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-900 rounded-xl text-sm font-bold hover:bg-gray-100 active:scale-95 transition-all"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          나도 만들기
        </Link>
      </div>
    </div>
  );
}
