'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react';

interface PageData {
  id: number;
  bgImage: string;
  overlay: string;
  title: string;
  subtitle: string;
  accent?: string;
  layout: string;
  bullets?: string[];
  titleStyle?: Record<string, unknown>;
  subtitleStyle?: Record<string, unknown>;
  elements?: unknown[];
}

function CardView({ page }: { page: PageData }) {
  const titleStyle = (page.titleStyle || {}) as Record<string, unknown>;
  const subtitleStyle = (page.subtitleStyle || {}) as Record<string, unknown>;
  const accent = page.accent || '#ffffff';

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden select-none"
      style={{ aspectRatio: '4/5', background: '#111' }}
    >
      <img src={page.bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: page.overlay }} />
      {page.layout === 'center' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <h2
            className="font-black leading-tight mb-3"
            style={{
              fontFamily: (titleStyle.fontFamily as string) || 'inherit',
              fontSize: `${((titleStyle.fontSize as number) || 36) / 420 * 100}vw`,
              color: (titleStyle.color as string) || '#fff',
              fontWeight: (titleStyle.fontWeight as string) || '900',
              maxWidth: '90%',
              wordBreak: 'keep-all',
            }}
          >
            {page.title}
          </h2>
          {page.subtitle && (
            <p className="text-white/80" style={{ fontSize: `${((subtitleStyle.fontSize as number) || 13) / 420 * 100}vw`, color: (subtitleStyle.color as string) || 'rgba(255,255,255,0.8)' }}>
              {page.subtitle}
            </p>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col justify-end px-5 pb-6">
          <h2
            className="font-black leading-tight mb-2"
            style={{
              fontFamily: (titleStyle.fontFamily as string) || 'inherit',
              fontSize: `${((titleStyle.fontSize as number) || 26) / 420 * 100}vw`,
              color: (titleStyle.color as string) || accent,
              fontWeight: (titleStyle.fontWeight as string) || '900',
              wordBreak: 'keep-all',
            }}
          >
            {page.title}
          </h2>
          <div className="space-y-1.5">
            {(page.bullets || []).map((b, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full mt-[0.45em] shrink-0" style={{ background: accent }} />
                <p className="text-white/85 leading-relaxed" style={{ fontSize: `${11 / 420 * 100}vw` }} dangerouslySetInnerHTML={{ __html: b }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ShareContent() {
  const params = useSearchParams();
  const token = params.get('t');
  const [pages, setPages] = useState<PageData[]>([]);
  const [title, setTitle] = useState('');
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setError('잘못된 공유 링크입니다'); setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`/api/share?token=${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPages(data.pages_data || []);
        setTitle(data.title || '카드뉴스');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '불러오기 실패');
      }
      setLoading(false);
    })();
  }, [token]);

  const prev = useCallback(() => setCurrent(c => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent(c => Math.min(pages.length - 1, c + 1)), [pages.length]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 size={28} className="animate-spin text-primary-500" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-400 text-lg mb-2">😕</p>
        <p className="text-gray-600 font-semibold">{error}</p>
        <a href="/" className="mt-4 inline-block text-sm text-primary-600 hover:underline">홈으로 돌아가기</a>
      </div>
    </div>
  );

  const page = pages[current];

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-black/50 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-white/60 text-xs">공유된 카드뉴스</p>
          <p className="text-white font-bold text-sm">{title}</p>
        </div>
        <a href="/" className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors">
          <ExternalLink size={12} /> simple로 만들기
        </a>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
        <div className="w-full max-w-sm">
          {page && <CardView page={page} />}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-4">
          <button onClick={prev} disabled={current === 0} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/20 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="flex gap-1.5">
            {pages.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white w-5' : 'bg-white/40'}`} />
            ))}
          </div>
          <button onClick={next} disabled={current === pages.length - 1} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/20 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
        <p className="text-white/40 text-xs">{current + 1} / {pages.length}</p>
      </div>

      {/* Footer CTA */}
      <div className="p-6 bg-black/30 text-center">
        <p className="text-white/50 text-xs mb-3">나도 AI로 카드뉴스 만들어보기</p>
        <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-colors">
          <Download size={14} /> simple 무료 시작
        </a>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-white/50" />
      </div>
    }>
      <ShareContent />
    </Suspense>
  );
}
