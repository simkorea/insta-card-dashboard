'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Film, Play, Pause, Download, RefreshCw, ChevronLeft, ChevronRight, Loader2, Check, AlertCircle } from 'lucide-react';

// ─── 슬라이드 렌더러 (영상 캡처용) ──────────────────────────────────────────
function SlideFrame({ page, width, height }: { page: any; width: number; height: number }) {
  const s = width / 420;
  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden', flexShrink: 0, background: '#111' }}>
      {page.bgImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.bgImage} alt="" crossOrigin="anonymous"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: page.overlay || 'rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'absolute', inset: 0 }}>
        {page.layout === 'center' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 40px', textAlign: 'center' }}>
            {page.title && <h1 style={{ fontSize: `${(page.titleStyle?.fontSize ?? 38) * s}px`, fontWeight: page.titleStyle?.fontWeight ?? '900', fontFamily: page.titleStyle?.fontFamily ?? 'Noto Sans KR', color: page.titleStyle?.color ?? '#fff', lineHeight: 1.2, whiteSpace: 'pre-line', margin: 0, maxWidth: '100%', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{page.title}</h1>}
            {page.subtitle && <p style={{ fontSize: `${(page.subtitleStyle?.fontSize ?? 14) * s}px`, fontWeight: page.subtitleStyle?.fontWeight ?? '400', fontFamily: page.titleStyle?.fontFamily ?? 'Noto Sans KR', color: page.subtitleStyle?.color ?? '#e5e7eb', lineHeight: 1.6, whiteSpace: 'pre-line', marginTop: 16, maxWidth: '100%', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{page.subtitle}</p>}
          </div>
        )}
        {(page.layout === 'bottom-left' || page.layout === 'bottom-left-list') && (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', padding: `0 ${32 * s}px ${40 * s}px`, gap: 20 * s }}>
            {page.title && <h2 style={{ fontSize: `${(page.titleStyle?.fontSize ?? 24) * s}px`, fontWeight: '900', fontFamily: page.titleStyle?.fontFamily ?? 'Noto Sans KR', color: page.titleStyle?.color ?? (page.accent || '#ffd700'), lineHeight: 1.2, margin: 0, maxWidth: '100%', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{page.title}</h2>}
            {page.bullets && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 * s }}>
                {page.bullets.map((b: string, i: number) => (
                  <p key={i} style={{ fontSize: `${(page.bulletStyle?.fontSize ?? 14) * s}px`, color: page.bulletStyle?.color ?? '#fff', lineHeight: 1.6, margin: 0 }}
                    dangerouslySetInnerHTML={{ __html: `• ${b.replace(/<b>(.*?)<\/b>/g, `<b style="color:${page.accent || '#ffd700'}">$1</b>`)}` }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {(page.elements || []).map((elem: any) => {
        const pxSize = (elem.size / 100) * width;
        const textW = elem.type === 'text' ? ((elem.width ?? 80) / 100) * width : pxSize;
        return (
          <div key={elem.id} style={{ position: 'absolute', left: `${elem.x}%`, top: `${elem.y}%`, width: elem.type === 'text' ? textW : pxSize, height: elem.type === 'text' ? 'auto' : pxSize, opacity: elem.opacity, zIndex: 15, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
            {elem.type === 'emoji' && <span style={{ fontSize: pxSize, lineHeight: 1 }}>{elem.emoji}</span>}
            {elem.type === 'text' && elem.text && <p style={{ fontSize: `${(elem.fontSize ?? 16) * s}px`, fontWeight: elem.fontWeight ?? '400', fontFamily: elem.fontFamily ?? 'Noto Sans KR', textAlign: elem.textAlign ?? 'left', color: elem.color, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{elem.text}</p>}
          </div>
        );
      })}
    </div>
  );
}

const TRANSITIONS = [
  { id: 'none',  label: '없음' },
  { id: 'fade',  label: '페이드' },
  { id: 'slide', label: '슬라이드' },
];

const RATIOS = [
  { id: '4:5',  label: '4:5 (인스타그램)', w: 420, h: 525 },
  { id: '1:1',  label: '1:1 (정사각형)',    w: 420, h: 420 },
  { id: '9:16', label: '9:16 (릴스/스토리)', w: 420, h: 747 },
];

export default function VideoGeneratorPage() {
  const [designs, setDesigns] = useState<any[]>([]);
  const [isLoadingDesigns, setIsLoadingDesigns] = useState(true);
  const [selectedDesign, setSelectedDesign] = useState<any>(null);
  const [duration, setDuration] = useState(2.5);
  const [transition, setTransition] = useState('fade');
  const [ratio, setRatio] = useState('4:5');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const ratioInfo = RATIOS.find(r => r.id === ratio) ?? RATIOS[0];
  const pages: any[] = selectedDesign?.pages_data ?? [];

  // 자동 로드
  useEffect(() => {
    fetch('/api/designs')
      .then(r => r.json())
      .then(d => { if (d.designs) setDesigns(d.designs); })
      .finally(() => setIsLoadingDesigns(false));
  }, []);

  // 슬라이드쇼 플레이
  useEffect(() => {
    if (isPlaying && pages.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % pages.length);
      }, duration * 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, duration, pages.length]);

  const handleSelectDesign = (design: any) => {
    setSelectedDesign(design);
    setCurrentSlide(0);
    setIsPlaying(false);
    setExportDone(false);
    setExportError('');
  };

  const proxyUrl = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

  const captureEl = async (el: HTMLDivElement): Promise<HTMLCanvasElement> => {
    const h2c = (await import('html2canvas')).default;
    const imgs = el.querySelectorAll<HTMLImageElement>('img');
    const origSrcs: string[] = [];
    imgs.forEach(img => {
      origSrcs.push(img.src);
      if (img.src && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
        img.src = proxyUrl(img.src);
      }
    });
    await new Promise<void>(r => {
      let loaded = 0;
      if (imgs.length === 0) { r(); return; }
      imgs.forEach(img => {
        if (img.complete) { if (++loaded === imgs.length) r(); }
        else { img.onload = img.onerror = () => { if (++loaded === imgs.length) r(); }; }
      });
    });
    const canvas = await h2c(el, { scale: 2, useCORS: false, allowTaint: false, logging: false });
    imgs.forEach((img, i) => { img.src = origSrcs[i]; });
    return canvas;
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const handleExport = useCallback(async () => {
    if (!selectedDesign || pages.length === 0) return;
    setIsExporting(true);
    setExportDone(false);
    setExportError('');

    try {
      // 1. 캔버스 셋업
      const EXPORT_W = ratioInfo.w * 2;
      const EXPORT_H = ratioInfo.h * 2;
      const canvas = document.createElement('canvas');
      canvas.width = EXPORT_W;
      canvas.height = EXPORT_H;
      const ctx = canvas.getContext('2d')!;

      // 2. 각 슬라이드 캡처
      const slideCanvases: HTMLCanvasElement[] = [];
      for (let i = 0; i < pages.length; i++) {
        setExportProgress(`슬라이드 캡처 중... (${i + 1}/${pages.length})`);
        const el = captureRefs.current[i];
        if (el) {
          const captured = await captureEl(el);
          slideCanvases.push(captured);
        }
      }

      if (slideCanvases.length === 0) throw new Error('슬라이드 캡처 실패');

      // 3. MediaRecorder 셋업
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      const recordingDone = new Promise<void>(resolve => {
        recorder.onstop = () => resolve();
      });
      recorder.start(100);

      const FPS = 30;
      const FRAME_MS = 1000 / FPS;
      const FADE_FRAMES = transition === 'fade' ? 15 : 0;
      const SLIDE_FRAMES = transition === 'slide' ? 20 : 0;

      const drawFrame = () => new Promise<void>(r => requestAnimationFrame(() => { r(); }));

      for (let i = 0; i < slideCanvases.length; i++) {
        setExportProgress(`영상 인코딩 중... (${i + 1}/${slideCanvases.length}장)`);
        const curr = slideCanvases[i];
        const next = slideCanvases[(i + 1) % slideCanvases.length];

        // 슬라이드 유지
        const holdFrames = Math.round(duration * FPS) - FADE_FRAMES - SLIDE_FRAMES;
        for (let f = 0; f < holdFrames; f++) {
          ctx.drawImage(curr, 0, 0, EXPORT_W, EXPORT_H);
          await drawFrame();
          await sleep(FRAME_MS);
        }

        // 페이드 전환
        if (transition === 'fade' && i < slideCanvases.length - 1) {
          for (let f = 0; f < FADE_FRAMES; f++) {
            const alpha = f / FADE_FRAMES;
            ctx.drawImage(curr, 0, 0, EXPORT_W, EXPORT_H);
            ctx.globalAlpha = alpha;
            ctx.drawImage(next, 0, 0, EXPORT_W, EXPORT_H);
            ctx.globalAlpha = 1;
            await drawFrame();
            await sleep(FRAME_MS);
          }
        }

        // 슬라이드 전환
        if (transition === 'slide' && i < slideCanvases.length - 1) {
          for (let f = 0; f < SLIDE_FRAMES; f++) {
            const offset = Math.round((f / SLIDE_FRAMES) * EXPORT_W);
            ctx.drawImage(curr, -offset, 0, EXPORT_W, EXPORT_H);
            ctx.drawImage(next, EXPORT_W - offset, 0, EXPORT_W, EXPORT_H);
            await drawFrame();
            await sleep(FRAME_MS);
          }
        }
      }

      recorder.stop();
      await recordingDone;

      // 4. 다운로드
      setExportProgress('파일 저장 중...');
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedDesign.name || 'cardnews'}_video.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
    } catch (e: any) {
      setExportError(e.message || '영상 생성 실패');
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  }, [selectedDesign, pages, duration, transition, ratio, ratioInfo]);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 md:mb-8 pl-10 md:pl-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow">
          <Film size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">영상 생성</h1>
          <p className="text-xs md:text-sm text-gray-500">카드뉴스를 인스타그램 릴스·스토리용 영상으로 변환합니다</p>
        </div>
        <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">Beta</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: Design selection + Preview */}
        <div className="space-y-6">
          {/* Design selection */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-4">저장된 디자인 선택</h2>
            {isLoadingDesigns ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : designs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">저장된 디자인이 없습니다</p>
                <a href="/cardnews" className="text-xs text-primary-600 hover:underline mt-1 block">카드뉴스 만들기 →</a>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                {designs.map(d => {
                  const fp = d.pages_data?.[0];
                  const isSelected = selectedDesign?.id === d.id;
                  return (
                    <button
                      key={d.id}
                      onClick={() => handleSelectDesign(d)}
                      className={`rounded-xl overflow-hidden border-2 transition-all text-left ${isSelected ? 'border-pink-500 shadow-md' : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      <div className="relative h-20 bg-gray-800 overflow-hidden">
                        {fp?.bgImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fp.bgImage.replace('w=800', 'w=120')} alt="" className="w-full h-full object-cover" />
                        )}
                        <div style={{ position: 'absolute', inset: 0, background: fp?.overlay || 'rgba(0,0,0,0.4)' }} />
                        {isSelected && (
                          <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center">
                            <Check size={20} className="text-white" />
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          {d.pages_data?.length ?? 0}장
                        </div>
                      </div>
                      <div className="px-2 py-1.5 bg-white">
                        <p className="text-[11px] font-bold text-gray-700 truncate">{d.name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview */}
          {selectedDesign && pages.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-700">미리보기</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentSlide(p => Math.max(0, p - 1))}
                    disabled={currentSlide === 0}
                    className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-bold text-gray-600">{currentSlide + 1} / {pages.length}</span>
                  <button
                    onClick={() => setCurrentSlide(p => Math.min(pages.length - 1, p + 1))}
                    disabled={currentSlide === pages.length - 1}
                    className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => setIsPlaying(p => !p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isPlaying ? 'bg-gray-900 text-white' : 'bg-pink-500 text-white hover:bg-pink-600'}`}
                  >
                    {isPlaying ? <><Pause size={12} /> 정지</> : <><Play size={12} /> 재생</>}
                  </button>
                </div>
              </div>

              {/* Slide preview */}
              <div className="flex justify-center">
                <div style={{ width: ratioInfo.w, height: ratioInfo.h, overflow: 'hidden', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                  <SlideFrame page={pages[currentSlide]} width={ratioInfo.w} height={ratioInfo.h} />
                </div>
              </div>

              {/* Slide dots */}
              <div className="flex justify-center gap-1.5 mt-4">
                {pages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setCurrentSlide(i); setIsPlaying(false); }}
                    className={`rounded-full transition-all ${i === currentSlide ? 'w-4 h-1.5 bg-pink-500' : 'w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400'}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Settings + Export */}
        <div className="space-y-4">
          {/* Settings */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-4">영상 설정</h2>

            {/* Duration */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-600 mb-2">
                슬라이드 표시 시간 <span className="text-pink-600">{duration}초</span>
              </label>
              <input
                type="range"
                min={1} max={5} step={0.5}
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full accent-pink-500"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>1초 (빠름)</span><span>3초</span><span>5초 (천천히)</span>
              </div>
            </div>

            {/* Transition */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-600 mb-2">전환 효과</label>
              <div className="grid grid-cols-3 gap-2">
                {TRANSITIONS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTransition(t.id)}
                    className={`py-2 rounded-lg text-xs font-bold border-2 transition-all ${transition === t.id ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ratio */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2">비율</label>
              <div className="space-y-1.5">
                {RATIOS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setRatio(r.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border-2 transition-all ${ratio === r.id ? 'border-pink-500 bg-pink-50 text-pink-700 font-bold' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}
                  >
                    <span>{r.label}</span>
                    <span className="text-[10px] opacity-60">{r.w}×{r.h}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Export Info */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              {selectedDesign
                ? `총 ${pages.length}장 × ${duration}초 = 약 ${(pages.length * duration).toFixed(0)}초 영상`
                : '디자인을 선택하면 영상 길이가 표시됩니다'}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">출력 형식: WebM (대부분 SNS 업로드 지원)</p>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={!selectedDesign || isExporting || pages.length === 0}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
              exportDone
                ? 'bg-green-500 text-white'
                : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 active:scale-[0.99]'
            }`}
          >
            {isExporting ? (
              <><Loader2 size={16} className="animate-spin" /> {exportProgress || '영상 생성 중...'}</>
            ) : exportDone ? (
              <><Check size={16} /> 다운로드 완료!</>
            ) : (
              <><Download size={16} /> 영상 생성 및 다운로드</>
            )}
          </button>

          {exportError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-600">{exportError}</p>
            </div>
          )}

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-bold text-blue-700 mb-2">💡 사용 팁</p>
            <ul className="text-[11px] text-blue-600 space-y-1 leading-relaxed">
              <li>• 릴스/스토리: 9:16 비율 권장</li>
              <li>• 피드 업로드: 4:5 또는 1:1</li>
              <li>• 슬라이드당 2-3초가 최적</li>
              <li>• WebM → MP4 변환: 클라우드컨버트 등 사용</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 오프스크린 고해상도 렌더 (캡처용) */}
      {selectedDesign && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
          {pages.map((page: any, i: number) => (
            <div key={i} ref={el => { captureRefs.current[i] = el; }}>
              <SlideFrame page={page} width={ratioInfo.w * 2} height={ratioInfo.h * 2} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
