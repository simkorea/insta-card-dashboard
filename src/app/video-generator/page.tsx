'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Play, Pause, Download, RefreshCw, ChevronLeft, ChevronRight, Loader2, Check, AlertCircle, Wand2, Copy, Upload, Plus, Trash2, Send } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

/**
 * 녹화 형식을 고른다. MP4(H.264)를 먼저 시도하는 이유:
 * 인스타그램은 WebM을 아예 받지 않는다. 예전에는 WebM으로만 뽑아서
 * 릴스에 올리려면 밖에서 변환을 거쳐야 했다.
 * 최근 크롬은 MP4 녹화를 지원하므로 되면 그걸 쓰고, 안 되면 WebM으로 떨어진다.
 */
function pickRecorderType(): { mimeType: string; ext: string } {
  const candidates: [string, string][] = [
    ['video/mp4;codecs=avc1.42E01E', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [mimeType, ext] of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return { mimeType, ext };
    }
  }
  return { mimeType: '', ext: 'webm' };
}

// ─── 슬라이드 렌더러 (영상 캡처용) ──────────────────────────────────────────
function SlideFrame({ page, width, height }: { page: any; width: number; height: number }) {
  const s = width / 420;
  // 손글씨 노트·신문 카드는 그림 한 장이 카드 전체다.
  // 이런 장은 (1) 잘리면 안 되고 (2) 어둡게 덮으면 글씨가 안 보이고
  // (3) 위에 텍스트를 또 얹으면 같은 말이 두 번 나온다.
  const isWholeImage = page.styleVariant === 'image' && Boolean(page.bgImage);

  if (isWholeImage) {
    // 고른 비율과 카드 비율이 다르면 잘라내지 않고 여백을 둔다(레터박스).
    // 예전에는 cover라서 9:16을 고르면 카드 좌우가 잘려나갔다.
    return (
      <div style={{ width, height, position: 'relative', overflow: 'hidden', flexShrink: 0, background: '#F3F1EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={page.bgImage} alt="" crossOrigin="anonymous"
          style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
      </div>
    );
  }

  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden', flexShrink: 0, background: '#111' }}>
      {page.bgImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.bgImage} alt="" crossOrigin="anonymous"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: page.overlay ?? 'rgba(0,0,0,0.4)' }} />
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
  const [videoMode, setVideoMode] = useState<'slideshow' | 'script' | 'prompt'>('slideshow');
  
  // 모드3 영상 프롬프트 생성기 상태
  const [promptSource, setPromptSource] = useState<'design' | 'manual'>('design');
  const [manualText, setManualText] = useState('');
  const [sceneCount, setSceneCount] = useState(5);
  const [promptLoading, setPromptLoading] = useState(false);
  const [scenes, setScenes] = useState<any[]>([]);
  const [promptError, setPromptError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // 모드3 영상 업로드 및 자막 굽기 상태
  const [uploadedVideo, setUploadedVideo] = useState<string>('');
  const [videoFileName, setVideoFileName] = useState<string>('');
  const [captions, setCaptions] = useState<{ text: string; start: number; end: number }[]>([]);
  const [subtitleStyle] = useState({ fontSize: 48, color: '#fff', bottom: 120 });
  const [burning, setBurning] = useState(false);
  const [burnProgress, setBurnProgress] = useState('');
  const [burnError, setBurnError] = useState('');

  // 모드2 TTS 테스트 상태
  const [ttsText, setTtsText] = useState('');
  const [ttsVoice, setTtsVoice] = useState('ko-KR-InJoonNeural');
  const [ttsAudio, setTtsAudio] = useState('');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState('');

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
  // 만든 영상을 들고 있다가 발행 화면으로 바로 넘기기 위한 상태
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedName, setExportedName] = useState('');
  const [exportedExt, setExportedExt] = useState('mp4');
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const [exportError, setExportError] = useState('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const videoElRef = useRef<HTMLVideoElement | null>(null);

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
    setExportedBlob(null);

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
      const { mimeType, ext } = pickRecorderType();
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

      // 4. 다운로드 + 바로 올리기용으로 들고 있는다
      setExportProgress('파일 저장 중...');
      const blob = new Blob(chunks, { type: mimeType || `video/${ext}` });
      const fileName = `${selectedDesign.name || 'cardnews'}_video.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setExportedBlob(blob);
      setExportedName(fileName);
      setExportedExt(ext);
      setExportDone(true);
    } catch (e: any) {
      setExportError(e.message || '영상 생성 실패');
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  }, [selectedDesign, pages, duration, transition, ratio, ratioInfo]);

  /**
   * 방금 만든 영상을 저장소에 올리고 발행 화면으로 넘긴다.
   * 파일은 Vercel을 거치지 않고 브라우저에서 Supabase로 바로 간다 —
   * 라우트는 본문이 약 4.5MB로 제한돼 영상을 통과시킬 수 없다.
   */
  const handleUploadToPublish = async () => {
    if (!exportedBlob) return;
    setUploading(true);
    setExportError('');
    try {
      const signRes = await fetch('/api/upload-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: `video.${exportedExt}`,
          contentType: exportedBlob.type,
          size: exportedBlob.size,
        }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign.error || '업로드 준비에 실패했습니다.');

      const supabase = createSupabaseBrowser();
      const { error } = await supabase.storage
        .from(sign.bucket)
        .uploadToSignedUrl(sign.path, sign.token, exportedBlob, {
          contentType: exportedBlob.type.split(';')[0] || `video/${exportedExt}`,
        });
      if (error) throw new Error(`업로드 실패: ${error.message}`);

      router.push(
        `/reels?video=${encodeURIComponent(sign.publicUrl)}&name=${encodeURIComponent(exportedName)}`
      );
    } catch (e: any) {
      setExportError(e?.message || '업로드 중 오류가 발생했습니다.');
      setUploading(false);
    }
  };

  const handleGeneratePrompts = async () => {
    let source = '';
    if (promptSource === 'design') {
      if (!selectedDesign || !selectedDesign.pages_data) return;
      source = selectedDesign.pages_data
        .map((page: any, idx: number) => {
          const pageNum = `[장면 ${idx + 1}]`;
          const title = page.title ? `제목: ${page.title}` : '';
          const subtitle = page.subtitle ? `서브카피: ${page.subtitle}` : '';
          const bullets = page.bullets && page.bullets.length > 0 ? `불릿: ${page.bullets.join(', ')}` : '';
          return [pageNum, title, subtitle, bullets].filter(Boolean).join('\n');
        })
        .join('\n\n');
    } else {
      source = manualText;
    }

    if (!source.trim()) {
      setPromptError('생성할 원본 텍스트 소스가 비어 있습니다.');
      return;
    }

    setPromptLoading(true);
    setPromptError('');
    setScenes([]);
    setCopiedAll(false);
    setCopiedIndex(null);

    try {
      const res = await fetch('/api/generate/video-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, sceneCount }),
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      if (data.scenes) {
        setScenes(data.scenes);
      }
    } catch (e: any) {
      setPromptError(e.message || '프롬프트 생성 실패');
    } finally {
      setPromptLoading(false);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUploadedVideo(url);
    setVideoFileName(file.name);
    setBurnError('');
    setBurnProgress('');
  };

  const handleBurnSubtitle = async () => {
    const video = videoElRef.current;
    if (!video || !uploadedVideo) return;

    setBurning(true);
    setBurnError('');
    setBurnProgress('인코딩 시작 대기 중...');

    try {
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // MediaRecorder setup
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4000000 });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordingDone = new Promise<void>(resolve => {
        recorder.onstop = () => resolve();
      });

      // 영상 처음으로 이동 및 재생 대기
      video.currentTime = 0;
      video.muted = true; // 브라우저 자동 재생 정책 및 녹화 중 소리 방지
      await video.play();

      recorder.start(100);

      // 자막 스타일
      const fontSize = subtitleStyle.fontSize * (w / 1280); // 가변 폰트 크기 계산
      const textBottom = subtitleStyle.bottom * (h / 720); // 가변 위치 계산
      ctx.font = `bold ${fontSize}px Noto Sans KR, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      let active = true;
      const drawLoop = () => {
        if (!active) return;

        // 프레임 복사
        ctx.drawImage(video, 0, 0, w, h);

        // 자막 렌더링
        const t = video.currentTime;
        const currentCaption = captions.find(c => {
          const start = Number(c.start);
          const end = Number(c.end);
          if (isNaN(start) || isNaN(end)) return false;
          return t >= start && t <= end;
        });

        if (currentCaption && currentCaption.text.trim()) {
          const text = currentCaption.text;
          const x = w / 2;
          const y = h - textBottom;

          // 검은 외곽선
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(4, w / 150);
          ctx.lineJoin = 'round';
          ctx.strokeText(text, x, y);

          // 흰 글씨
          ctx.fillStyle = subtitleStyle.color;
          ctx.fillText(text, x, y);
        }

        // 진척도
        const pct = video.duration ? Math.min(100, Math.round((t / video.duration) * 100)) : 0;
        setBurnProgress(`자막 굽는 중... (${pct}%)`);

        if (video.ended || video.paused) {
          active = false;
          recorder.stop();
          return;
        }

        requestAnimationFrame(() => {
          drawLoop();
        });
      };

      // 루프 시작
      drawLoop();

      await recordingDone;

      // 파일 다운로드
      setBurnProgress('파일 저장 중...');
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = videoFileName ? videoFileName.substring(0, videoFileName.lastIndexOf('.')) || videoFileName : 'video';
      a.download = `${baseName}_subtitled.webm`;
      a.click();
      URL.revokeObjectURL(url);

      setBurnProgress('자막 굽기 완료!');
    } catch (err: any) {
      setBurnError(err.message || '인코딩 중 에러가 발생했습니다.');
    } finally {
      setBurning(false);
    }
  };

  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) {
      setTtsError('텍스트를 입력해주세요.');
      return;
    }

    setTtsLoading(true);
    setTtsError('');
    setTtsAudio('');

    try {
      const res = await fetch('/api/generate/tts-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsText, voice: ttsVoice }),
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      if (data.audio) {
        setTtsAudio(`data:audio/mp3;base64,${data.audio}`);
      }
    } catch (e: any) {
      setTtsError(e.message || '음성 합성에 실패했습니다.');
    } finally {
      setTtsLoading(false);
    }
  };

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

      {/* Video Mode Tabs */}
      <div className="flex gap-2.5 mb-6 border-b border-gray-100 overflow-x-auto pb-1 shrink-0">
        <button
          onClick={() => setVideoMode('slideshow')}
          className={`pb-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            videoMode === 'slideshow' ? 'border-primary-600 text-primary-600 font-extrabold' : 'border-transparent text-gray-400 hover:text-gray-600 font-medium'
          }`}
        >
          🎞 카드뉴스 → 슬라이드쇼
        </button>
        <button
          onClick={() => setVideoMode('script')}
          className={`pb-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            videoMode === 'script' ? 'border-primary-600 text-primary-600 font-extrabold' : 'border-transparent text-gray-400 hover:text-gray-600 font-medium'
          }`}
        >
          📝 글 → 음성 → 영상
        </button>
        <button
          onClick={() => setVideoMode('prompt')}
          className={`pb-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            videoMode === 'prompt' ? 'border-primary-600 text-primary-600 font-extrabold' : 'border-transparent text-gray-400 hover:text-gray-600 font-medium'
          }`}
        >
          ✨ 프롬프트 생성 + 영상 업로드
        </button>
      </div>

      {videoMode === 'slideshow' && (
        <>
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
                <p className="text-[10px] text-gray-400 mt-1">출력 형식: MP4 (지원하지 않는 브라우저에서는 WebM)</p>
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

              {/* 만든 영상을 그대로 발행 화면으로 넘긴다 */}
              {exportedBlob && (
                <button
                  onClick={handleUploadToPublish}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {uploading
                    ? <><Loader2 size={16} className="animate-spin" /> 올리는 중...</>
                    : <><Send size={16} /> 이 영상 바로 발행하기</>}
                </button>
              )}
              {exportedBlob && exportedExt === 'webm' && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  이 브라우저가 MP4 녹화를 지원하지 않아 WebM으로 만들어졌습니다.
                  유튜브·틱톡은 그대로 올라가지만 인스타그램은 WebM을 받지 않습니다.
                </p>
              )}

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
                  <li>• 만든 뒤 &lsquo;바로 발행하기&rsquo;로 릴스·쇼츠·틱톡에 올릴 수 있습니다</li>
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
        </>
      )}

      {videoMode === 'script' && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-1.5">📢 한국어 음성 생성 테스트 (Edge-TTS)</h3>
            <p className="text-xs text-gray-400 mb-4">텍스트를 입력하고 목소리를 선택한 뒤 음성을 테스트 생성해보세요.</p>
          </div>

          <div className="space-y-3">
            <textarea
              value={ttsText}
              onChange={e => setTtsText(e.target.value)}
              placeholder="음성으로 변환할 내용을 입력하세요"
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none resize-none"
            />
            
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="w-full sm:w-auto space-y-1.5">
                <label className="block text-xs font-bold text-gray-500">목소리 선택</label>
                <select
                  value={ttsVoice}
                  onChange={e => setTtsVoice(e.target.value)}
                  className="w-full sm:w-48 px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white cursor-pointer"
                >
                  <option value="ko-KR-InJoonNeural">👨 인준 (InJoon - 남성)</option>
                  <option value="ko-KR-SunHiNeural">👩 선희 (SunHi - 여성)</option>
                  <option value="ko-KR-HyunsuNeural">👨 현수 (Hyunsu - 남성)</option>
                </select>
              </div>

              <button
                onClick={handleGenerateTTS}
                disabled={ttsLoading || !ttsText.trim()}
                className="w-full sm:flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm hover:from-pink-600 hover:to-rose-600 disabled:opacity-40 transition-all shadow-sm active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                {ttsLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> 음성 생성 중...</>
                ) : (
                  <><Wand2 size={16} /> 음성 생성 테스트</>
                )}
              </button>
            </div>

            {ttsError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-600">{ttsError}</p>
              </div>
            )}

            {ttsAudio && (
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <label className="block text-xs font-bold text-gray-600">🎧 생성된 음성 재생</label>
                <audio src={ttsAudio} controls className="w-full" />
              </div>
            )}
          </div>
        </div>
      )}

      {videoMode === 'prompt' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-5">
            <div>
              <h2 className="text-sm font-bold text-gray-700 mb-3">입력 소스 선택</h2>
              {/* 입력 소스 탭 */}
              <div className="flex gap-2.5 mb-4 border-b border-gray-100 overflow-x-auto pb-1 shrink-0">
                <button
                  onClick={() => setPromptSource('design')}
                  className={`pb-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                    promptSource === 'design' ? 'border-primary-600 text-primary-600 font-extrabold' : 'border-transparent text-gray-400 hover:text-gray-600 font-medium'
                  }`}
                >
                  📁 저장된 카드뉴스에서
                </button>
                <button
                  onClick={() => setPromptSource('manual')}
                  className={`pb-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                    promptSource === 'manual' ? 'border-primary-600 text-primary-600 font-extrabold' : 'border-transparent text-gray-400 hover:text-gray-600 font-medium'
                  }`}
                >
                  ✍️ 직접 입력
                </button>
              </div>
            </div>

            {/* 디자인에서 가져오기 */}
            {promptSource === 'design' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500">저장된 디자인 선택</h3>
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
                {selectedDesign && (
                  <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 border border-gray-100 leading-relaxed">
                    🎯 선택된 디자인: <strong>{selectedDesign.name}</strong> (총 {selectedDesign.pages_data?.length ?? 0}개 슬라이드 텍스트 추출 가능)
                  </div>
                )}
              </div>
            )}

            {/* 직접 입력 */}
            {promptSource === 'manual' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500">영상 주제 및 텍스트 소스</label>
                <textarea
                  value={manualText}
                  onChange={e => setManualText(e.target.value)}
                  placeholder="영상으로 만들 주제나 내용을 입력하세요 (예: 부동산 소액 투자 전략, 아파트 청약 꿀팁 등)"
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none resize-none"
                />
              </div>
            )}

            {/* 장면 개수 선택 및 실행 버튼 */}
            <div className="flex flex-col sm:flex-row gap-4 items-end pt-2 border-t border-gray-100">
              <div className="w-full sm:w-auto space-y-1.5">
                <label className="block text-xs font-bold text-gray-500">장면 개수 (3~8개)</label>
                <select
                  value={sceneCount}
                  onChange={e => setSceneCount(Number(e.target.value))}
                  className="w-full sm:w-32 px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white cursor-pointer"
                >
                  {[3, 4, 5, 6, 7, 8].map(num => (
                    <option key={num} value={num}>{num}개 장면</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGeneratePrompts}
                disabled={promptLoading || (promptSource === 'design' ? !selectedDesign : !manualText.trim())}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm hover:from-pink-600 hover:to-rose-600 disabled:opacity-40 transition-all shadow-sm active:scale-[0.99] cursor-pointer"
              >
                {promptLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> 프롬프트 생성 중...</>
                ) : (
                  <><Wand2 size={16} /> AI 영상 프롬프트 생성</>
                )}
              </button>
            </div>

            {promptError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-600">{promptError}</p>
              </div>
            )}
          </div>

          {/* 생성 결과 영역 */}
          {scenes.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pl-1">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  ✨ 추천 영상 프롬프트 결과
                </h3>
                <button
                  onClick={() => {
                    const allPrompts = scenes.map(s => s.prompt).join('\n');
                    navigator.clipboard.writeText(allPrompts);
                    setCopiedAll(true);
                    setTimeout(() => setCopiedAll(false), 2000);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${copiedAll ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                >
                  {copiedAll ? <><Check size={12} /> 전체 복사 완료</> : <><Copy size={12} /> 전체 프롬프트 복사</>}
                </button>
              </div>

              <div className="space-y-3">
                {scenes.map((sceneObj, index) => {
                  const isCopied = copiedIndex === index;
                  return (
                    <div key={index} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <span className="text-[10px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-bold">장면 {sceneObj.scene ?? index + 1}</span>
                          <h4 className="text-sm font-bold text-gray-800 mt-1">{sceneObj.ko}</h4>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(sceneObj.prompt);
                            setCopiedIndex(index);
                            setTimeout(() => setCopiedIndex(null), 2000);
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors shrink-0 cursor-pointer ${
                            isCopied
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {isCopied ? <><Check size={10} /> 복사됨</> : <><Copy size={10} /> 복사</>}
                        </button>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 font-mono text-xs text-gray-600 leading-relaxed select-all">
                        {sceneObj.prompt}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 영상 업로드 및 자막 굽기 영역 */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                🎬 영상 업로드 & 자막 굽기
              </h3>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
                외부 도구(Seedance/Kling 등)에서 만든 영상을 올려 자막을 입히세요.
                출력은 WebM 형식이며, 브라우저 렌더링 재인코딩 방식이므로 원본 음성은 포함되지 않습니다.
              </p>

              {/* 업로드 Input */}
              <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-6 bg-gray-50 hover:bg-gray-100/50 transition-colors flex flex-col items-center justify-center text-center cursor-pointer group">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-400 group-hover:text-pink-500 transition-colors shadow-sm mb-2">
                  <Upload size={18} />
                </div>
                <p className="text-xs font-bold text-gray-600">
                  {videoFileName ? `선택된 파일: ${videoFileName}` : '비디오 파일 업로드'}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">클릭하거나 비디오 파일을 드래그하여 놓으세요</p>
              </div>
            </div>

            {/* 업로드된 비디오 미리보기 */}
            {uploadedVideo && (
              <div className="space-y-4">
                <div className="flex justify-center bg-gray-900 rounded-xl p-2 max-h-[360px] overflow-hidden">
                  <video
                    ref={videoElRef}
                    src={uploadedVideo}
                    controls
                    className="max-h-[340px] rounded-lg"
                  />
                </div>

                {/* 자막 리스트 편집 */}
                <div className="space-y-3.5 pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-gray-600">자막 목록 ({captions.length}개)</label>
                    <button
                      onClick={() => setCaptions(prev => [...prev, { text: '', start: 0, end: 3 }])}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[10px] font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <Plus size={10} /> 자막 줄 추가
                    </button>
                  </div>

                  {captions.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400">
                      추가된 자막이 없습니다. 위의 버튼을 눌러 자막을 추가해보세요.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {captions.map((caption, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                          <input
                            type="text"
                            value={caption.text}
                            onChange={e => {
                              const text = e.target.value;
                              setCaptions(prev => prev.map((c, i) => i === idx ? { ...c, text } : c));
                            }}
                            placeholder="자막 내용을 입력하세요"
                            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-pink-300"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              placeholder="시작(초)"
                              value={caption.start || 0}
                              onChange={e => {
                                const start = parseFloat(e.target.value) || 0;
                                setCaptions(prev => prev.map((c, i) => i === idx ? { ...c, start } : c));
                              }}
                              className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center bg-white"
                            />
                            <span className="text-[10px] text-gray-400">~</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              placeholder="종료(초)"
                              value={caption.end || 0}
                              onChange={e => {
                                const end = parseFloat(e.target.value) || 0;
                                setCaptions(prev => prev.map((c, i) => i === idx ? { ...c, end } : c));
                              }}
                              className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center bg-white"
                            />
                          </div>
                          <button
                            onClick={() => setCaptions(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="자막 삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 굽기 버튼 */}
                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3 items-center">
                  <button
                    onClick={handleBurnSubtitle}
                    disabled={burning || captions.length === 0}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm hover:from-pink-600 hover:to-rose-600 disabled:opacity-40 transition-all shadow-sm active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {burning ? (
                      <><Loader2 size={16} className="animate-spin" /> {burnProgress || '자막 굽는 중...'}</>
                    ) : (
                      <><Wand2 size={16} /> 자막 입혀서 영상 굽기</>
                    )}
                  </button>
                </div>

                {burnError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-600">{burnError}</p>
                  </div>
                )}
                {burning && burnProgress && !burnError && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl text-xs font-semibold">
                    <Loader2 size={14} className="animate-spin text-blue-500 shrink-0" />
                    <span>{burnProgress}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
