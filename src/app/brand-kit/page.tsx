'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Palette, Type, Image as ImageIcon, Check, Loader2, Upload, X,
  RotateCcw, Sparkles, Brain, ChevronDown, ChevronUp, Trash2,
  History, Plus, ArrowRight, LayoutTemplate,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ─── 상수 ────────────────────────────────────────────────────────────────────
const FONT_OPTIONS = [
  { label: 'Noto Sans KR (기본)', value: 'Noto Sans KR' },
  { label: 'Nanum Gothic', value: 'Nanum Gothic' },
  { label: 'Nanum Myeongjo', value: 'Nanum Myeongjo' },
  { label: 'Black Han Sans (임팩트)', value: 'Black Han Sans' },
  { label: 'Nanum Pen Script (손글씨)', value: 'Nanum Pen Script' },
  { label: 'Do Hyeon', value: 'Do Hyeon' },
  { label: 'Jua', value: 'Jua' },
  { label: 'Gothic A1', value: 'Gothic A1' },
];

const COLOR_PRESETS = [
  { name: '미드나잇 블루', primary: '#1e3a5f', secondary: '#4a9eff' },
  { name: '레드 에너지', primary: '#c0392b', secondary: '#e74c3c' },
  { name: '그린 네이처', primary: '#27ae60', secondary: '#2ecc71' },
  { name: '퍼플 럭셔리', primary: '#6c3483', secondary: '#9b59b6' },
  { name: '골드 프리미엄', primary: '#d4a017', secondary: '#f0c040' },
  { name: '다크 모노', primary: '#1a1a2e', secondary: '#6c757d' },
  { name: '코랄 소프트', primary: '#e17055', secondary: '#fab1a0' },
  { name: '틸 모던', primary: '#00695c', secondary: '#4db6ac' },
];

const STYLE_KEYWORD_KO: Record<string, string> = {
  clean: '깔끔한', bold: '강렬한', elegant: '우아한', playful: '발랄한',
  modern: '모던한', minimal: '미니멀', vibrant: '생동감', dark: '다크',
  pastel: '파스텔', professional: '전문적',
};
const LAYOUT_KO: Record<string, string> = {
  centered: '중앙형', split: '좌우분할', 'corner-text': '모서리형',
  'full-overlay': '전체오버레이', 'minimal-card': '미니멀', 'bold-banner': '배너형',
};
const FONT_STYLE_MAP: Record<string, string> = {
  'sans-serif': 'Noto Sans KR', 'serif': 'Nanum Myeongjo',
  'display': 'Black Han Sans', 'handwriting': 'Nanum Pen Script',
};

// ─── 인터페이스 ──────────────────────────────────────────────────────────────
interface BrandKit {
  brand_name: string; primary_color: string; secondary_color: string;
  font_family: string; logo_url: string;
}
interface DesignProfile {
  primaryColor: string; secondaryColor: string; backgroundColor: string;
  textColor: string; fontWeight: string; fontStyle: string; layoutType: string;
  hasGradient: boolean; styleKeywords: string[]; contentRatio: string;
  imageCount: number; savedAt?: string;
}
interface TemplateSlide {
  imageKeyword: string; overlay: string; layout: string;
  title: string; subtitle: string; accent: string;
  bullets: string[];
  titleStyle: { fontSize: number; fontWeight: string; color: string };
  subtitleStyle: { fontSize: number; fontWeight: string; color: string };
  bulletStyle: { fontSize: number; fontWeight: string; color: string };
  sourceThumb?: string;
}
interface SavedTemplate {
  id: string; name: string; createdAt: string; slides: TemplateSlide[];
}

const DEFAULT_KIT: BrandKit = {
  brand_name: '', primary_color: '#6366f1', secondary_color: '#818cf8',
  font_family: 'Noto Sans KR', logo_url: '',
};
const HISTORY_KEY = 'design_style_history';
const MY_TEMPLATES_KEY = 'my_card_templates';

// ─── 유틸 ────────────────────────────────────────────────────────────────────
async function compressImage(dataUrl: string, maxPx = 700): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.65));
    };
    img.src = dataUrl;
  });
}

function loadHistory(): DesignProfile[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(profile: DesignProfile) {
  const h = loadHistory();
  h.unshift({ ...profile, savedAt: new Date().toISOString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 10)));
}
function loadMyTemplates(): SavedTemplate[] {
  try { return JSON.parse(localStorage.getItem(MY_TEMPLATES_KEY) || '[]'); } catch { return []; }
}
function saveMyTemplate(name: string, slides: TemplateSlide[]) {
  const list = loadMyTemplates();
  list.unshift({ id: Date.now().toString(), name, createdAt: new Date().toISOString(), slides });
  localStorage.setItem(MY_TEMPLATES_KEY, JSON.stringify(list.slice(0, 10)));
}
function deleteMyTemplate(id: string) {
  const list = loadMyTemplates().filter(t => t.id !== id);
  localStorage.setItem(MY_TEMPLATES_KEY, JSON.stringify(list));
}

// ─── 미니 슬라이드 프리뷰 컴포넌트 ──────────────────────────────────────────
function MiniSlide({ slide, sourceThumb }: { slide: TemplateSlide; sourceThumb?: string }) {
  const overlayColor = slide.overlay.includes('rgba(0,0,0')
    ? 'rgba(0,0,0,0.75)' : 'rgba(10,10,30,0.80)';

  return (
    <div className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '4/5', background: '#111' }}>
      {/* 배경 이미지 썸네일 (원본 업로드 이미지) */}
      {sourceThumb && (
        <img src={sourceThumb} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
      )}
      {/* 오버레이 */}
      <div className="absolute inset-0" style={{ background: slide.overlay || overlayColor }} />
      {/* 텍스트 레이어 */}
      <div className="absolute inset-0 flex flex-col justify-end p-3 gap-1.5">
        {slide.layout === 'center' ? (
          <div className="flex flex-col items-center justify-center h-full gap-1 text-center px-2">
            <p className="font-black leading-tight line-clamp-2"
              style={{ fontSize: `${Math.min((slide.titleStyle?.fontSize || 32) * 0.38, 14)}px`, color: slide.titleStyle?.color || '#fff' }}>
              {slide.title}
            </p>
            {slide.subtitle && (
              <p className="opacity-70 line-clamp-1"
                style={{ fontSize: `${Math.min((slide.subtitleStyle?.fontSize || 14) * 0.38, 8)}px`, color: '#ccc' }}>
                {slide.subtitle}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-start gap-1">
              <span style={{ color: slide.accent || '#ffd700', fontSize: '9px' }}>●</span>
              <p className="font-black leading-tight line-clamp-2"
                style={{ fontSize: `${Math.min((slide.titleStyle?.fontSize || 24) * 0.38, 11)}px`, color: slide.titleStyle?.color || (slide.accent || '#ffd700') }}>
                {slide.title}
              </p>
            </div>
            {(slide.bullets || []).slice(0, 3).map((b, i) => (
              <div key={i} className="flex items-start gap-1">
                <span className="opacity-50 text-white" style={{ fontSize: '6px', marginTop: '1px' }}>•</span>
                <p className="opacity-80 line-clamp-1"
                  style={{ fontSize: `${Math.min((slide.bulletStyle?.fontSize || 14) * 0.34, 8)}px`, color: '#fff' }}>
                  {b}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
      {/* 강조색 하단 바 */}
      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: slide.accent || '#ffd700' }} />
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function BrandKitPage() {
  const router = useRouter();
  const [kit, setKit] = useState<BrandKit>(DEFAULT_KIT);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoPreview, setLogoPreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // AI 디자인 학습
  const [learnImages, setLearnImages] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [designProfile, setDesignProfile] = useState<DesignProfile | null>(null);
  const [learnError, setLearnError] = useState('');
  const [learnOpen, setLearnOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<DesignProfile[]>([]);
  const learnRef = useRef<HTMLInputElement>(null);

  // 이미지로 템플릿 만들기
  const [tmplImages, setTmplImages] = useState<string[]>([]);
  const [tmplAnalyzing, setTmplAnalyzing] = useState(false);
  const [tmplStep, setTmplStep] = useState(0);
  const [tmplResults, setTmplResults] = useState<TemplateSlide[]>([]);
  const [tmplError, setTmplError] = useState('');
  const [tmplOpen, setTmplOpen] = useState(false);
  const tmplRef = useRef<HTMLInputElement>(null);

  // 나만의 템플릿
  const [myTemplates, setMyTemplates] = useState<SavedTemplate[]>([]);
  const [myTmplOpen, setMyTmplOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    const gfLink = document.createElement('link');
    gfLink.rel = 'stylesheet';
    gfLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&family=Nanum+Gothic:wght@400;700;800&family=Nanum+Myeongjo:wght@400;700;800&family=Black+Han+Sans&family=Nanum+Pen+Script&family=Do+Hyeon&family=Jua&family=Gothic+A1:wght@400;700;900&display=swap';
    document.head.appendChild(gfLink);
    setHistory(loadHistory());
    setMyTemplates(loadMyTemplates());
    return () => { document.head.removeChild(gfLink); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/brand-kit');
        const { kit: remote } = await res.json();
        if (remote) {
          const loaded: BrandKit = {
            brand_name: remote.layout_style || '',
            primary_color: remote.primary_color || '#6366f1',
            secondary_color: remote.accent_color || '#818cf8',
            font_family: remote.font_style || 'Noto Sans KR',
            logo_url: remote.description || '',
          };
          setKit(loaded);
          if (loaded.logo_url) setLogoPreview(loaded.logo_url);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setLogoPreview(url);
      setKit(prev => ({ ...prev, logo_url: url }));
    };
    reader.readAsDataURL(file);
  };

  // 초기화는 화면 값만 되돌리고 저장은 하지 않았다. 그래서 누른 뒤 새로고침하면
  // 예전 설정이 그대로 돌아와 "눌러도 안 된다"로 보였다. 확인창도 없어서
  // 실수로 누르면 브랜드 설정이 통째로 날아갔다.
  const handleReset = async () => {
    if (!confirm('브랜드 설정을 기본값으로 되돌릴까요?\n브랜드명·로고·색상·폰트가 모두 초기화되고 바로 저장됩니다.')) return;
    setResetting(true);
    try {
      const res = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_KIT),
      });
      if (!res.ok) throw new Error('저장에 실패했습니다.');
      setKit(DEFAULT_KIT);
      setLogoPreview('');
      localStorage.removeItem('brand_kit');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      alert('초기화에 실패했습니다: ' + (e?.message || '알 수 없는 오류'));
    } finally {
      setResetting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_name: kit.brand_name, primary_color: kit.primary_color, secondary_color: kit.secondary_color, font_family: kit.font_family, logo_url: kit.logo_url }),
      });
      localStorage.setItem('brand_kit', JSON.stringify({ logo: kit.logo_url, color: kit.primary_color, secondary_color: kit.secondary_color, font_family: kit.font_family, name: kit.brand_name }));
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  // ── 학습 이미지 업로드 (최대 10장) ──────────────────────────────────────
  const addImages = (files: File[], setImages: React.Dispatch<React.SetStateAction<string[]>>, max: number) => {
    const remaining = max - (setImages === setLearnImages ? learnImages.length : tmplImages.length);
    files.slice(0, remaining).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setImages(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const handleLearnUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    addImages(Array.from(e.target.files || []), setLearnImages, 10);
    e.target.value = '';
  };
  const handleTmplUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    addImages(Array.from(e.target.files || []), setTmplImages, 10);
    e.target.value = '';
  };

  // ── AI 디자인 학습 분석 ──────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!learnImages.length) return;
    setAnalyzing(true); setLearnError(''); setDesignProfile(null); setAnalyzeStep(0);
    try {
      const results: Record<string, unknown>[] = [];
      for (let i = 0; i < learnImages.length; i++) {
        setAnalyzeStep(i + 1);
        const compressed = await compressImage(learnImages[i]);
        const res = await fetch('/api/analyze/design-style', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: [compressed] }),
        });
        if (!res.ok) throw new Error(await res.text().then(t => t.slice(0, 80)));
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        results.push(data.profile);
      }
      const avgHex = (key: string) => {
        const hexes = results.map(r => r[key] as string).filter(h => h && /^#[0-9A-Fa-f]{6}$/.test(h));
        if (!hexes.length) return '#6366f1';
        const rgbs = hexes.map(h => ({ r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16) }));
        const a = { r: Math.round(rgbs.reduce((s,c)=>s+c.r,0)/rgbs.length), g: Math.round(rgbs.reduce((s,c)=>s+c.g,0)/rgbs.length), b: Math.round(rgbs.reduce((s,c)=>s+c.b,0)/rgbs.length) };
        return `#${a.r.toString(16).padStart(2,'0')}${a.g.toString(16).padStart(2,'0')}${a.b.toString(16).padStart(2,'0')}`;
      };
      const mode = (key: string) => {
        const vals = results.map(r => r[key]).filter(Boolean);
        const cnt: Record<string,number> = {};
        vals.forEach(v => { const k=String(v); cnt[k]=(cnt[k]||0)+1; });
        return Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]?.[0] || '';
      };
      const allKw: string[] = results.flatMap(r => (r.styleKeywords as string[]|undefined)||[]);
      const kwCnt: Record<string,number> = {};
      allKw.forEach(k=>{kwCnt[k]=(kwCnt[k]||0)+1;});
      const topKw = Object.entries(kwCnt).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);
      setDesignProfile({
        primaryColor: avgHex('primaryColor'), secondaryColor: avgHex('secondaryColor'),
        backgroundColor: avgHex('backgroundColor'), textColor: avgHex('textColor'),
        fontWeight: mode('fontWeight')||'bold', fontStyle: mode('fontStyle')||'sans-serif',
        layoutType: mode('layoutType')||'centered', hasGradient: results.some(r=>r.hasGradient===true),
        styleKeywords: topKw.length?topKw:['modern'], contentRatio: mode('contentRatio')||'balanced',
        imageCount: learnImages.length,
      });
    } catch (e: any) { setLearnError(e.message); }
    finally { setAnalyzing(false); setAnalyzeStep(0); }
  };

  // ── 이미지 → 템플릿 변환 ────────────────────────────────────────────────
  const handleTmplAnalyze = async () => {
    if (!tmplImages.length) return;
    setTmplAnalyzing(true); setTmplError(''); setTmplResults([]); setTmplStep(0);
    try {
      const slides: TemplateSlide[] = [];
      for (let i = 0; i < tmplImages.length; i++) {
        setTmplStep(i + 1);
        const compressed = await compressImage(tmplImages[i]);
        const res = await fetch('/api/analyze/image-to-template', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: compressed }),
        });
        if (!res.ok) throw new Error(await res.text().then(t => t.slice(0, 80)));
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        slides.push({ ...data.template, sourceThumb: tmplImages[i] });
      }
      setTmplResults(slides);
    } catch (e: any) { setTmplError(e.message); }
    finally { setTmplAnalyzing(false); setTmplStep(0); }
  };

  const slidesToPages = (slides: TemplateSlide[]) =>
    slides.map((s, i) => ({
      id: i + 1,
      bgImage: s.sourceThumb || 'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=800&q=80',
      bgLabel: s.imageKeyword || '배경 이미지',
      overlay: s.overlay,
      title: s.title || '제목을 입력하세요',
      subtitle: s.subtitle || '',
      accent: s.accent || '#ffd700',
      layout: (s.layout === 'center' ? 'center' : s.layout === 'bottom-left' ? 'bottom-left' : 'bottom-left-list') as 'center' | 'bottom-left' | 'bottom-left-list',
      bullets: s.bullets?.length ? s.bullets : ['내용을 입력하세요'],
      titleStyle: s.titleStyle,
      subtitleStyle: s.subtitleStyle,
      bulletStyle: s.bulletStyle,
      imageKeyword: s.imageKeyword,
    }));

  const openInEditor = (slides?: TemplateSlide[]) => {
    const pages = slidesToPages(slides || tmplResults);
    localStorage.setItem('cardnews_import_templates', JSON.stringify(pages));
    router.push('/cardnews/editor');
  };

  const handleSaveTemplate = () => {
    const name = saveName.trim();
    if (!name || !tmplResults.length) return;
    saveMyTemplate(name, tmplResults);
    setMyTemplates(loadMyTemplates());
    setShowSaveInput(false);
    setSaveName('');
    setMyTmplOpen(true);
  };

  const handleDeleteTemplate = (id: string) => {
    deleteMyTemplate(id);
    setMyTemplates(loadMyTemplates());
  };

  const applyProfile = (profile: DesignProfile) => {
    const fontFamily = FONT_STYLE_MAP[profile.fontStyle] || 'Noto Sans KR';
    setKit(prev => ({ ...prev, primary_color: profile.primaryColor, secondary_color: profile.secondaryColor, font_family: fontFamily }));
    saveHistory(profile); setHistory(loadHistory());
    setDesignProfile(null); setLearnImages([]); setLearnOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToEditorWithStyle = (profile: DesignProfile) => {
    const fontFamily = FONT_STYLE_MAP[profile.fontStyle] || 'Noto Sans KR';
    localStorage.setItem('brand_kit', JSON.stringify({ logo: kit.logo_url, color: profile.primaryColor, secondary_color: profile.secondaryColor, font_family: fontFamily, name: kit.brand_name }));
    router.push('/cardnews');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 size={24} className="animate-spin text-primary-500" />
    </div>
  );

  // ── 이미지 그리드 공통 컴포넌트 ─────────────────────────────────────────
  const ImageGrid = ({
    images, onRemove, onAdd, max, fileRef: ref, onUpload, addBtnLabel
  }: {
    images: string[]; onRemove: (i: number) => void; onAdd: () => void;
    max: number; fileRef: React.RefObject<HTMLInputElement | null>;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    addBtnLabel?: string;
  }) => (
    <div>
      {images.length === 0 ? (
        <button onClick={onAdd}
          className="w-full border-2 border-dashed border-violet-300 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-violet-500 hover:bg-violet-50/50 transition-colors">
          <Upload size={24} className="text-violet-400" />
          <p className="text-sm font-bold text-violet-600">이미지 업로드</p>
          <p className="text-xs text-violet-400">JPG, PNG, WEBP · 최대 {max}장</p>
        </button>
      ) : (
        <div className="grid grid-cols-5 gap-1.5">
          {images.map((img, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden group" style={{ aspectRatio: '4/5', background: '#000' }}>
              <img src={img} alt="" className="w-full h-full object-cover" />
              <button onClick={() => onRemove(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={9} className="text-white" />
              </button>
              <div className="absolute bottom-0.5 left-0.5 text-[8px] text-white/70 font-bold bg-black/40 px-1 rounded">{i+1}</div>
            </div>
          ))}
          {images.length < max && (
            <button onClick={onAdd}
              className="rounded-lg border-2 border-dashed border-violet-200 hover:border-violet-400 flex flex-col items-center justify-center gap-0.5 transition-colors"
              style={{ aspectRatio: '4/5' }}>
              <Plus size={16} className="text-violet-300" />
              <span className="text-[9px] text-violet-300">{addBtnLabel || '추가'}</span>
            </button>
          )}
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={onUpload} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-gray-900">브랜드 키트</h1>
          <p className="text-xs text-gray-400 mt-0.5">로고·색상·폰트를 저장하면 모든 카드에 자동 적용됩니다</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? '저장됨' : '저장하기'}
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-5">

        {/* ══ 이미지로 템플릿 만들기 ══════════════════════════════════════════ */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
          <button onClick={() => setTmplOpen(v => !v)}
            className="w-full flex items-center justify-between p-5 text-left">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <LayoutTemplate size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-black text-blue-900">이미지로 템플릿 만들기</p>
                <p className="text-xs text-blue-600 mt-0.5">내 카드뉴스 이미지를 올리면 동일한 구조의 편집 가능한 템플릿을 생성합니다</p>
              </div>
            </div>
            {tmplOpen ? <ChevronUp size={16} className="text-blue-400 shrink-0" /> : <ChevronDown size={16} className="text-blue-400 shrink-0" />}
          </button>

          {tmplOpen && (
            <div className="px-5 pb-5 border-t border-blue-100 pt-4 space-y-4">
              <p className="text-xs text-blue-700 font-medium">
                내가 만들었던 카드뉴스 이미지 1~10장을 업로드하세요.<br/>
                AI가 각 슬라이드의 레이아웃·색상·오버레이·텍스트 배치를 분석해서 에디터에서 편집 가능한 템플릿으로 변환합니다.
              </p>

              <ImageGrid
                images={tmplImages}
                onRemove={i => setTmplImages(prev => prev.filter((_,idx)=>idx!==i))}
                onAdd={() => tmplRef.current?.click()}
                max={10}
                fileRef={tmplRef}
                onUpload={handleTmplUpload}
                addBtnLabel="추가"
              />

              {/* 분석 중 진행 */}
              {tmplAnalyzing && (
                <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Loader2 size={15} className="animate-spin text-blue-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-blue-700">{tmplStep}/{tmplImages.length}번째 슬라이드 구조 분석 중...</p>
                    <div className="w-full bg-blue-200 rounded-full h-1.5 mt-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${(tmplStep / tmplImages.length) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {!tmplAnalyzing && tmplImages.length > 0 && tmplResults.length === 0 && (
                <button onClick={handleTmplAnalyze}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm">
                  <Sparkles size={15} /> {tmplImages.length}장 슬라이드 → 템플릿 생성하기
                </button>
              )}

              {tmplError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{tmplError}</p>}

              {/* 생성된 템플릿 미리보기 */}
              {tmplResults.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-gray-800 flex items-center gap-1.5">
                      <Check size={14} className="text-green-500" />
                      {tmplResults.length}개 슬라이드 템플릿 생성 완료
                    </p>
                    <button onClick={() => { setTmplResults([]); setTmplImages([]); }}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors">다시 시작</button>
                  </div>

                  {/* 미니 슬라이드 그리드 */}
                  <div className="grid grid-cols-5 gap-2">
                    {tmplResults.map((slide, i) => (
                      <div key={i} className="space-y-1">
                        <MiniSlide slide={slide} sourceThumb={slide.sourceThumb} />
                        <p className="text-[9px] text-gray-400 text-center font-medium">{i+1}번 슬라이드</p>
                      </div>
                    ))}
                  </div>

                  {/* 스타일 요약 */}
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-500 mb-2">추출된 스타일 요약</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(new Set(tmplResults.map(s => s.accent).filter(Boolean))).slice(0, 3).map(color => (
                        <div key={color} className="flex items-center gap-1 text-[10px] text-gray-600">
                          <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ background: color }} />
                          <span className="font-mono">{color}</span>
                        </div>
                      ))}
                      {Array.from(new Set(tmplResults.map(s => s.layout))).map(layout => (
                        <span key={layout} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold">
                          {layout === 'center' ? '중앙 정렬' : layout === 'bottom-left' ? '좌하단' : '리스트형'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => openInEditor()}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md">
                      <ArrowRight size={15} /> 에디터에서 편집하기
                    </button>
                    <button onClick={() => { setShowSaveInput(v => !v); setSaveName(''); }}
                      className="px-4 py-3 border-2 border-blue-300 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-50 transition-all flex items-center gap-1.5">
                      <Plus size={14} /> 저장
                    </button>
                  </div>

                  {showSaveInput && (
                    <div className="flex gap-2">
                      <input
                        type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                        placeholder="템플릿 이름 (예: 부동산 뉴스 스타일)"
                        className="flex-1 px-3 py-2.5 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        autoFocus
                      />
                      <button onClick={handleSaveTemplate} disabled={!saveName.trim()}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-blue-700 transition-all flex items-center gap-1">
                        <Check size={14} /> 저장
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 text-center">에디터에서 텍스트·이미지를 자유롭게 수정할 수 있습니다</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══ 나만의 템플릿 ═══════════════════════════════════════════════════ */}
        {myTemplates.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={() => setMyTmplOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
                  <LayoutTemplate size={14} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">나만의 템플릿 ({myTemplates.length})</p>
                  <p className="text-xs text-gray-400">저장한 카드뉴스 템플릿을 언제든지 불러올 수 있습니다</p>
                </div>
              </div>
              {myTmplOpen ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
            </button>

            {myTmplOpen && (
              <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                {myTemplates.map(tpl => (
                  <div key={tpl.id} className="border border-gray-100 rounded-xl p-3 space-y-3 hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{tpl.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {tpl.slides.length}개 슬라이드 · {new Date(tpl.createdAt).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteTemplate(tpl.id)}
                        className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* 슬라이드 미리보기 */}
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(tpl.slides.length, 5)}, 1fr)` }}>
                      {tpl.slides.slice(0, 5).map((slide, i) => (
                        <div key={i} className="space-y-0.5">
                          <MiniSlide slide={slide} sourceThumb={slide.sourceThumb} />
                          <p className="text-[8px] text-gray-400 text-center">{i + 1}</p>
                        </div>
                      ))}
                      {tpl.slides.length > 5 && (
                        <div className="rounded-lg bg-gray-50 flex items-center justify-center" style={{ aspectRatio: '4/5' }}>
                          <p className="text-xs text-gray-400 font-bold">+{tpl.slides.length - 5}</p>
                        </div>
                      )}
                    </div>

                    <button onClick={() => openInEditor(tpl.slides)}
                      className="w-full py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
                      <ArrowRight size={14} /> 이 템플릿으로 편집하기
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ AI 디자인 학습 (색상·스타일 추출) ════════════════════════════════ */}
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200 shadow-sm overflow-hidden">
          <button onClick={() => setLearnOpen(v => !v)}
            className="w-full flex items-center justify-between p-5 text-left">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center shrink-0">
                <Brain size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-black text-violet-900">AI 디자인 학습</p>
                <p className="text-xs text-violet-600 mt-0.5">이미지에서 색상·폰트 스타일을 추출해 브랜드 키트에 자동 적용</p>
              </div>
            </div>
            {learnOpen ? <ChevronUp size={16} className="text-violet-400 shrink-0" /> : <ChevronDown size={16} className="text-violet-400 shrink-0" />}
          </button>

          {learnOpen && (
            <div className="px-5 pb-5 border-t border-violet-100 pt-4 space-y-4">
              <p className="text-xs text-violet-700 font-medium">
                내 카드뉴스 이미지 2~10장을 업로드하세요. AI가 1장씩 분석 후 색상·폰트·레이아웃을 종합합니다.
              </p>

              <ImageGrid
                images={learnImages}
                onRemove={i => setLearnImages(prev => prev.filter((_,idx)=>idx!==i))}
                onAdd={() => learnRef.current?.click()}
                max={10}
                fileRef={learnRef}
                onUpload={handleLearnUpload}
                addBtnLabel="추가"
              />

              {analyzing && (
                <div className="bg-violet-50 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Loader2 size={15} className="animate-spin text-violet-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-violet-700">{analyzeStep}/{learnImages.length}장 분석 중...</p>
                    <div className="w-full bg-violet-200 rounded-full h-1.5 mt-1.5">
                      <div className="bg-violet-600 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${(analyzeStep / learnImages.length) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {!analyzing && learnImages.length > 0 && !designProfile && (
                <button onClick={handleAnalyze}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm">
                  <Sparkles size={15} /> {learnImages.length}장 이미지 AI 분석하기
                </button>
              )}
              {learnError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{learnError}</p>}

              {designProfile && (
                <div className="bg-white rounded-xl border border-violet-200 p-4 space-y-3">
                  <p className="text-sm font-black text-gray-800 flex items-center gap-1.5"><Sparkles size={14} className="text-violet-600" /> 분석 완료</p>
                  <div className="flex gap-3">
                    {[
                      { label: '주 색상', color: designProfile.primaryColor },
                      { label: '보조 색상', color: designProfile.secondaryColor },
                      { label: '배경', color: designProfile.backgroundColor },
                      { label: '텍스트', color: designProfile.textColor },
                    ].map(c => (
                      <div key={c.label} className="flex flex-col items-center gap-1">
                        <div className="w-11 h-11 rounded-xl border-2 border-white shadow-md" style={{ background: c.color }} />
                        <span className="text-[9px] font-mono text-gray-500">{c.color}</span>
                        <span className="text-[9px] text-gray-400">{c.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {designProfile.styleKeywords.map(kw => (
                      <span key={kw} className="text-xs px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-full font-bold">
                        {STYLE_KEYWORD_KO[kw] || kw}
                      </span>
                    ))}
                    {designProfile.hasGradient && <span className="text-xs px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-full font-bold">그라디언트</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => applyProfile(designProfile)}
                      className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5">
                      <Check size={14} /> 브랜드 키트에 적용
                    </button>
                    <button onClick={() => goToEditorWithStyle(designProfile)}
                      className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5">
                      <ArrowRight size={14} /> 이 스타일로 카드 만들기
                    </button>
                    <button onClick={() => { setDesignProfile(null); setLearnImages([]); }}
                      className="px-3 py-2.5 border border-gray-200 rounded-xl text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 학습 기록 ─────────────────────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={() => setHistoryOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <History size={14} className="text-gray-400" />
                <p className="text-sm font-bold text-gray-700">학습 기록 ({history.length})</p>
              </div>
              {historyOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            {historyOpen && (
              <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                    <div className="flex gap-1 shrink-0">
                      <div className="w-6 h-6 rounded-lg shadow-sm" style={{ background: h.primaryColor }} />
                      <div className="w-6 h-6 rounded-lg shadow-sm" style={{ background: h.secondaryColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-1 flex-wrap">
                        {h.styleKeywords.slice(0,2).map(kw => (
                          <span key={kw} className="text-[9px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded-full font-bold">{STYLE_KEYWORD_KO[kw]||kw}</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400">{LAYOUT_KO[h.layoutType]||h.layoutType} · {h.imageCount}장{h.savedAt&&` · ${new Date(h.savedAt).toLocaleDateString('ko-KR')}`}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={()=>applyProfile(h)} className="text-[11px] px-2 py-1.5 bg-violet-50 text-violet-700 rounded-lg font-bold hover:bg-violet-100">적용</button>
                      <button onClick={()=>goToEditorWithStyle(h)} className="text-[11px] px-2 py-1.5 bg-primary-50 text-primary-700 rounded-lg font-bold hover:bg-primary-100">카드</button>
                    </div>
                  </div>
                ))}
                <button onClick={()=>{localStorage.removeItem(HISTORY_KEY);setHistory([]);setHistoryOpen(false);}} className="text-xs text-gray-400 hover:text-red-400">기록 삭제</button>
              </div>
            )}
          </div>
        )}

        {/* ── 현재 브랜드 키트 미리보기 ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">현재 브랜드 키트 미리보기</p>
          <div className="rounded-xl p-6 flex flex-col items-center gap-3"
            style={{ background: `linear-gradient(135deg, ${kit.primary_color}22, ${kit.secondary_color}22)`, border: `2px solid ${kit.primary_color}30` }}>
            {logoPreview
              ? <img src={logoPreview} alt="logo" className="h-12 object-contain" />
              : <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl" style={{ background: kit.primary_color }}>
                  {kit.brand_name ? kit.brand_name[0].toUpperCase() : 'B'}
                </div>}
            <p className="font-bold text-lg" style={{ fontFamily: kit.font_family, color: kit.primary_color }}>{kit.brand_name || '브랜드 이름'}</p>
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ background: kit.primary_color }} />
              <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ background: kit.secondary_color }} />
            </div>
            <p className="text-sm text-gray-500" style={{ fontFamily: kit.font_family }}>폰트: {kit.font_family}</p>
          </div>
        </div>

        {/* ── 브랜드 이름 ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center"><Type size={14} className="text-blue-600" /></div>
            <p className="text-sm font-bold text-gray-800">브랜드 이름</p>
          </div>
          <input type="text" value={kit.brand_name} onChange={e => setKit(prev => ({ ...prev, brand_name: e.target.value }))}
            placeholder="내 브랜드 이름을 입력하세요"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>

        {/* ── 로고 ────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center"><ImageIcon size={14} className="text-orange-500" /></div>
            <p className="text-sm font-bold text-gray-800">브랜드 로고</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          {logoPreview ? (
            <div className="flex items-center gap-4">
              <img src={logoPreview} alt="logo" className="h-16 object-contain border border-gray-200 rounded-xl p-2 bg-gray-50" />
              <div className="flex flex-col gap-2">
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"><Upload size={13} /> 교체</button>
                <button onClick={() => { setLogoPreview(''); setKit(prev => ({ ...prev, logo_url: '' })); }} className="flex items-center gap-1.5 px-3 py-2 border border-red-100 rounded-lg text-sm text-red-500 hover:bg-red-50"><X size={13} /> 삭제</button>
              </div>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-primary-300 hover:bg-primary-50/30 transition-colors">
              <Upload size={20} className="text-gray-300" />
              <p className="text-sm text-gray-400">클릭하여 로고 업로드</p>
              <p className="text-xs text-gray-300">PNG, SVG, JPG (권장: 투명 배경 PNG)</p>
            </button>
          )}
        </div>

        {/* ── 색상 ────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center"><Palette size={14} className="text-purple-600" /></div>
            <p className="text-sm font-bold text-gray-800">브랜드 색상</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            {[
              { label: '주 색상', key: 'primary_color' as const },
              { label: '보조 색상', key: 'secondary_color' as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <p className="text-xs text-gray-500 mb-2 font-medium">{label}</p>
                <div className="flex items-center gap-2">
                  <input type="color" value={kit[key]} onChange={e => setKit(prev => ({ ...prev, [key]: e.target.value }))} className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200 p-0.5" />
                  <input type="text" value={kit[key]} onChange={e => setKit(prev => ({ ...prev, [key]: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mb-3 font-medium">색상 프리셋</p>
          <div className="grid grid-cols-4 gap-2">
            {COLOR_PRESETS.map(preset => (
              <button key={preset.name} onClick={() => setKit(prev => ({ ...prev, primary_color: preset.primary, secondary_color: preset.secondary }))}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-gray-100 hover:border-gray-300 transition-colors" title={preset.name}>
                <div className="flex gap-1">
                  <div className="w-5 h-5 rounded-full" style={{ background: preset.primary }} />
                  <div className="w-5 h-5 rounded-full" style={{ background: preset.secondary }} />
                </div>
                <span className="text-[9px] text-gray-500 text-center leading-tight">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── 폰트 ────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center"><Type size={14} className="text-green-600" /></div>
            <p className="text-sm font-bold text-gray-800">브랜드 폰트</p>
          </div>
          <div className="space-y-2">
            {FONT_OPTIONS.map(font => (
              <button key={font.value} onClick={() => setKit(prev => ({ ...prev, font_family: font.value }))}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${kit.font_family === font.value ? 'border-primary-300 bg-primary-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                <span className="text-sm" style={{ fontFamily: font.value }}>{font.label}</span>
                <span className="text-base text-gray-400" style={{ fontFamily: font.value }}>가나다Aa</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pb-8">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-300 rounded-lg px-1.5 py-1 transition-colors">
            <RotateCcw size={13} /> {resetting ? '초기화 중...' : '초기화'}
          </button>
          <Link href="/cardnews" className="text-sm text-primary-600 font-semibold hover:underline">카드뉴스 에디터로 이동 →</Link>
        </div>
      </div>
    </div>
  );
}
