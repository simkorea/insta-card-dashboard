'use client';
import { useState, useEffect, useRef } from 'react';
import { ImagePlus, ChevronLeft, Search, RefreshCw, MessageSquare, Settings, ChevronUp, ChevronDown, UploadCloud, Trash2, Pencil, Loader2, Calendar, Clock, Copy, Check, X, Send, RefreshCcw, Images, Sparkles, Wand2, Globe, Lock, Download, Upload, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { friendlyError } from '@/lib/errors';

// ─── 슬라이드 렌더러 (카로셀 캡처용) ────────────────────────────────────────
const CAPTURE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;900' +
  '&family=Nanum+Gothic:wght@400;700;800' +
  '&family=Black+Han+Sans' +
  '&family=Gothic+A1:wght@300;400;500;600;700;900' +
  '&family=Nanum+Myeongjo:wght@400;700;800' +
  '&family=Do+Hyeon' +
  '&family=Jua' +
  '&family=Gowun+Dodum' +
  '&display=swap';

function SlideCapture({ page }: { page: any }) {
  const W = 420;
  const H = 525;
  const s = 1;
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={page.bgImage} alt="" crossOrigin="anonymous"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: page.overlay }} />
      <div style={{ position: 'absolute', inset: 0 }}>
        {page.layout === 'center' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 40px', textAlign: 'center' }}>
            <h1 style={{
              fontSize: `${(page.titleStyle?.fontSize ?? 38) * s}px`,
              fontWeight: page.titleStyle?.fontWeight ?? '900',
              fontFamily: page.titleStyle?.fontFamily ?? 'Noto Sans KR',
              color: page.titleStyle?.color ?? '#FFFFFF',
              lineHeight: page.titleStyle?.lineHeight ?? 1.2,
              whiteSpace: 'pre-line',
            }}>{page.title}</h1>
            <div style={{ width: 64, height: 2, background: 'rgba(255,255,255,0.5)', margin: '16px 0' }} />
            {page.subtitle && (
              <p style={{
                fontSize: `${(page.subtitleStyle?.fontSize ?? 14) * s}px`,
                fontWeight: page.subtitleStyle?.fontWeight ?? '400',
                fontFamily: page.subtitleStyle?.fontFamily ?? page.titleStyle?.fontFamily ?? 'Noto Sans KR',
                color: page.subtitleStyle?.color ?? '#E5E7EB',
                lineHeight: page.subtitleStyle?.lineHeight ?? 1.6,
                whiteSpace: 'pre-line',
              }}>{page.subtitle}</p>
            )}
          </div>
        )}
        {(page.layout === 'bottom-left' || page.layout === 'bottom-left-list') && (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', padding: `0 32px 40px`, gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ color: page.accent || '#ffd700', fontSize: `${(page.titleStyle?.fontSize ?? 24) * s}px`, marginTop: 2 }}>●</span>
              <h2 style={{
                fontSize: `${(page.titleStyle?.fontSize ?? 24) * s}px`,
                fontWeight: page.titleStyle?.fontWeight ?? '900',
                fontFamily: page.titleStyle?.fontFamily ?? 'Noto Sans KR',
                color: page.titleStyle?.color ?? (page.accent || '#ffd700'),
                lineHeight: page.titleStyle?.lineHeight ?? 1.2,
                textDecoration: 'underline',
                textDecorationColor: 'rgba(255,215,0,0.5)',
              }}>{page.title}</h2>
            </div>
            {page.bullets && (
              <div style={{ paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {page.bullets.map((b: string, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: `${(page.bulletStyle?.fontSize ?? 14) * s}px`, marginTop: 2 }}>•</span>
                    <p style={{
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
      {/* Free-placement text/shape/emoji elements */}
      {(page.elements || []).map((elem: any) => {
        const pxSize = (elem.size / 100) * W;
        const textW = elem.type === 'text' ? ((elem.width ?? 80) / 100) * W : pxSize;
        return (
          <div key={elem.id} style={{
            position: 'absolute', left: `${elem.x}%`, top: `${elem.y}%`,
            width: elem.type === 'text' ? `${textW}px` : `${pxSize}px`,
            height: elem.type === 'text' ? 'auto' : `${pxSize}px`,
            opacity: elem.opacity, zIndex: 15, transform: 'translate(-50%,-50%)', pointerEvents: 'none',
          }}>
            {elem.type === 'emoji' && <span style={{ fontSize: `${pxSize}px`, lineHeight: 1 }}>{elem.emoji}</span>}
            {elem.type === 'text' && elem.text && (
              <p style={{
                fontSize: `${elem.fontSize ?? 16}px`, fontWeight: elem.fontWeight ?? '400',
                fontFamily: elem.fontFamily ?? 'Noto Sans KR',
                textAlign: elem.textAlign ?? 'left', color: elem.color,
                lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, padding: '2px 4px',
              }}>{elem.text}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 히스토리 카드 미리보기 (CSS 렌더, 캔버스 없음) ──────────────────────────
function MiniCardPreview({ page }: { page: any }) {
  if (!page) return <div style={{ width: '100%', height: '100%', background: '#1a1a2e' }} />;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {page.bgImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.bgImage.replace('w=800', 'w=300')}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
        />
      )}
      <div style={{ position: 'absolute', inset: 0, background: page.overlay || 'rgba(0,0,0,0.45)' }} />
      {page.layout === 'center' ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px', textAlign: 'center' }}>
          {page.title && (
            <p style={{
              color: page.titleStyle?.color || '#fff', fontSize: '10px', fontWeight: '900',
              lineHeight: 1.3, textShadow: '0 1px 4px rgba(0,0,0,0.7)',
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', margin: 0,
            }}>{page.title}</p>
          )}
          {page.subtitle && (
            <p style={{ color: page.subtitleStyle?.color || '#ddd', fontSize: '7px', marginTop: 4, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', margin: '4px 0 0' }}>
              {page.subtitle}
            </p>
          )}
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '8px 10px' }}>
          {page.title && (
            <p style={{
              color: page.titleStyle?.color || page.accent || '#ffd700', fontSize: '9px', fontWeight: '900',
              lineHeight: 1.3, textShadow: '0 1px 4px rgba(0,0,0,0.8)',
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', margin: 0,
            }}>{page.title}</p>
          )}
        </div>
      )}
    </div>
  );
}

const recommendationTags = ['공간 소개', '숨은 카페 추천', '제주도 핫플 5곳', '마케팅 전략', '서비스 제안서', '비 오는 날 플리', '주간 트렌드'];
const ratioOptions = [
  { label: '1:1 (정사각형)', value: '1:1' },
  { label: '4:5 (인스타그램 권장)', value: '4:5' },
  { label: '16:9 (PPT/YouTube)', value: '16:9' },
  { label: '9:16 (릴스/스토리)', value: '9:16' },
  { label: '3:4 (세로형)', value: '3:4' }
];

const BUILT_IN_THEMES = [
  { id: 'business', label: '비즈니스', emoji: '🏢' },
  { id: 'cafe', label: '카페', emoji: '☕' },
  { id: 'lifestyle', label: '라이프스타일', emoji: '🌿' },
  { id: 'travel', label: '여행', emoji: '✈️' },
  { id: 'fashion', label: '패션/뷰티', emoji: '👗' },
  { id: 'food', label: '음식/맛집', emoji: '🍜' },
  { id: 'education', label: '교육', emoji: '📚' },
];

export default function CardNewsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'create' | 'learn' | 'history' | 'schedule' | 'analytics'>('create');
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [visibleTemplateCount, setVisibleTemplateCount] = useState(8);
  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [prompt, setPrompt] = useState('');
  
  // 브랜드 페르소나 관련 상태 정의
  interface PersonaShort {
    id: string;
    persona_name?: string;
    brand_name: string;
  }
  const [personas, setPersonas] = useState<PersonaShort[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  
  useEffect(() => {
    fetch('/api/templates')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTemplates(data.data);
        }
      });
    fetchUserTemplates();

    // 브랜드 페르소나 목록 조회
    fetch('/api/brand-persona')
      .then(res => res.json())
      .then(data => {
        if (data.personas && Array.isArray(data.personas)) {
          setPersonas(data.personas);
          if (data.personas.length > 0) {
            setSelectedPersonaId(data.personas[0].id);
          }
        }
      })
      .catch(err => console.error('페르소나 목록 로드 실패:', err));
  }, []);

  // Settings states
  const [selectedRatio, setSelectedRatio] = useState('4:5');
  const [genStyle, setGenStyle] = useState<'free' | 'origin'>('origin');
  const [checkBeforeGen, setCheckBeforeGen] = useState(false);
  const [slideCountType, setSlideCountType] = useState('auto');
  const [slideCountNumber, setSlideCountNumber] = useState(5);
  const [quickSlideAuto, setQuickSlideAuto] = useState(true);
  const [isImageUploadOpen, setIsImageUploadOpen] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<'text' | 'url' | 'trend' | 'smart' | 'step9'>('text');
  const [urlInput, setUrlInput] = useState('');
  const [trendInput, setTrendInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [generatedBlogPost, setGeneratedBlogPost] = useState('');
  const [viralHooks, setViralHooks] = useState<string[]>([]);
  const [resultTab, setResultTab] = useState<'card' | 'blog'>('card');
  const [trendRecommendations, setTrendRecommendations] = useState<string[]>([]);
  const [isFetchingTrends, setIsFetchingTrends] = useState(false);

  // Smart AI 자동 생성
  const [smartKeyword, setSmartKeyword] = useState('');
  const [smartCategory, setSmartCategory] = useState('부동산');
  const [smartSlideCount, setSmartSlideCount] = useState(7);
  const [smartGenerating, setSmartGenerating] = useState(false);
  const [smartStep, setSmartStep] = useState('');

  // 9단계 정밀 제작 관련 상태
  const [step9Input, setStep9Input] = useState('');
  const [step9Category, setStep9Category] = useState('');
  const [step9Recency, setStep9Recency] = useState<'today' | 'week' | 'month' | 'evergreen'>('evergreen');
  const [step9Topics, setStep9Topics] = useState<string[]>([]);
  const [step9SelectedTopic, setStep9SelectedTopic] = useState('');
  const [isSuggestingTopics, setIsSuggestingTopics] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [useAiStyle, setUseAiStyle] = useState(false);
  const [aiRecommendedStyle, setAiRecommendedStyle] = useState<string | null>(null);

  // Tab: 브랜드 키트 (Brand Kit)
  const [brandKit, setBrandKit] = useState<{ logo: string; color: string; name: string; useAutoAccent: boolean }>({
    logo: '',
    color: '#0066FF',
    name: '',
    useAutoAccent: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem('brand_kit');
    if (saved) {
      try { setBrandKit(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const updateBrandKit = (updates: Partial<typeof brandKit>) => {
    const next = { ...brandKit, ...updates };
    setBrandKit(next);
    localStorage.setItem('brand_kit', JSON.stringify(next));
  };

  // Tab: 나만의 디자인 학습
  const [learnRatio, setLearnRatio] = useState('4:5');
  const [learnImages, setLearnImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [brandProfile, setBrandProfile] = useState<any>(null);
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [styleSaved, setStyleSaved] = useState(false);

  const handleLearnImagesUpload = (files: FileList) => {
    Array.from(files).slice(0, 5).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setLearnImages(prev => prev.length < 5 ? [...prev, dataUrl] : prev);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAnalyzeBrandStyle = async () => {
    if (learnImages.length === 0) return;
    setIsAnalyzing(true);
    setBrandProfile(null);
    try {
      const res = await fetch('/api/brand-style/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: learnImages }),
      });
      const data = await res.json();
      if (data.profile) setBrandProfile(data.profile);
    } catch { /* ignore */ } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveBrandStyle = async () => {
    if (!brandProfile) return;
    setIsSavingStyle(true);
    try {
      const name = `브랜드 스타일 ${new Date().toLocaleDateString('ko-KR')}`;
      await fetch('/api/brand-styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          primary_color: brandProfile.primaryColor,
          accent_color: brandProfile.accentColor,
          bg_style: brandProfile.bgStyle,
          font_style: brandProfile.fontStyle,
          mood: brandProfile.mood,
          overlay_strength: brandProfile.overlayStrength,
          layout_style: brandProfile.layoutStyle,
          color_palette: brandProfile.colorPalette,
          description: brandProfile.description,
        }),
      });
      setStyleSaved(true);
      setTimeout(() => setStyleSaved(false), 3000);
    } catch { /* ignore */ } finally {
      setIsSavingStyle(false);
    }
  };

  // 내 카드뉴스 (localStorage)
  interface SavedCardNews { id: string; name: string; createdAt: string; pages: any[]; }
  const MY_CARDNEWS_KEY = 'my_saved_cardnews';
  const [savedCardNews, setSavedCardNews] = useState<SavedCardNews[]>([]);
  const [userTemplates, setUserTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [deletingLocalId, setDeletingLocalId] = useState<string | null>(null);
  const [togglingPublicId, setTogglingPublicId] = useState<string | null>(null);
  const [communityTemplates, setCommunityTemplates] = useState<any[]>([]);
  const [isLoadingCommunity, setIsLoadingCommunity] = useState(false);
  const [usingCommunityId, setUsingCommunityId] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MY_CARDNEWS_KEY);
      if (raw) setSavedCardNews(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const handleOpenLocalCardNews = (cn: SavedCardNews) => {
    localStorage.setItem('cardnews_import_templates', JSON.stringify(cn.pages));
    router.push('/cardnews/editor');
  };

  const handleDeleteLocalCardNews = (id: string) => {
    setDeletingLocalId(id);
    try {
      const raw = localStorage.getItem(MY_CARDNEWS_KEY);
      const list: SavedCardNews[] = raw ? JSON.parse(raw) : [];
      const updated = list.filter(cn => cn.id !== id);
      localStorage.setItem(MY_CARDNEWS_KEY, JSON.stringify(updated));
      setSavedCardNews(updated);
    } catch { /* ignore */ } finally {
      setDeletingLocalId(null);
    }
  };

  // Tab: 생성기록
  const [designs, setDesigns] = useState<any[]>([]);
  const [isLoadingDesigns, setIsLoadingDesigns] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchDesigns = async () => {
    setIsLoadingDesigns(true);
    try {
      const res = await fetch('/api/designs');
      const data = await res.json();
      if (data.designs) setDesigns(data.designs);
    } catch { /* ignore */ } finally {
      setIsLoadingDesigns(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchDesigns();
      fetchUserTemplates();
      fetchCommunityTemplates();
    }
  }, [activeTab]);

  const fetchUserTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_templates')
        .select('id, name, category, pages, is_public, use_count, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setUserTemplates(data || []);
    } catch (err) {
      console.error('fetchUserTemplates error:', err);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const fetchCommunityTemplates = async () => {
    setIsLoadingCommunity(true);
    try {
      const supabase = createSupabaseBrowser();
      const { data } = await supabase
        .from('user_templates')
        .select('id, name, category, pages, author_email, use_count, created_at')
        .eq('is_public', true)
        .order('use_count', { ascending: false })
        .limit(20);
      setCommunityTemplates(data || []);
    } catch { /* ignore */ } finally {
      setIsLoadingCommunity(false);
    }
  };

  const handleTogglePublic = async (tpl: any) => {
    setTogglingPublicId(tpl.id);
    try {
      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const newPublic = !tpl.is_public;
      const updates: any = { is_public: newPublic };
      if (newPublic) updates.author_email = user.email;
      await supabase.from('user_templates').update(updates).eq('id', tpl.id).eq('user_id', user.id);
      setUserTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, is_public: newPublic } : t));
      if (newPublic) fetchCommunityTemplates();
    } catch { /* ignore */ } finally {
      setTogglingPublicId(null);
    }
  };

  const handleExportTemplate = (tpl: any) => {
    const exportData = { name: tpl.name, category: tpl.category, pages: tpl.pages, version: '1.0' };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tpl.name.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (!json.pages || !Array.isArray(json.pages)) { alert('올바른 템플릿 파일이 아닙니다.'); return; }
        const supabase = createSupabaseBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { alert('로그인이 필요합니다.'); return; }
        const name = json.name || `가져온 템플릿 ${new Date().toLocaleDateString('ko-KR')}`;
        const category = json.category || '내 템플릿';
        await supabase.from('user_templates').upsert(
          { user_id: user.id, name, category, pages: json.pages, is_public: false },
          { onConflict: 'user_id,name' }
        );
        await fetchUserTemplates();
        alert(`"${name}" 템플릿을 가져왔습니다.`);
      } catch { alert('파일을 읽는 중 오류가 발생했습니다.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUseCommunityTemplate = async (tpl: any) => {
    setUsingCommunityId(tpl.id);
    try {
      const supabase = createSupabaseBrowser();
      await supabase.from('user_templates').update({ use_count: (tpl.use_count || 0) + 1 }).eq('id', tpl.id);
      localStorage.setItem('cardnews_import_templates', JSON.stringify(tpl.pages));
      localStorage.removeItem('editingDesign');
      localStorage.removeItem('cardNewsData');
      window.location.href = '/cardnews/editor';
    } catch {
      localStorage.setItem('cardnews_import_templates', JSON.stringify(tpl.pages));
      window.location.href = '/cardnews/editor';
    }
  };

  const handleUseTemplate = (tpl: any) => {
    localStorage.setItem('cardnews_import_templates', JSON.stringify(tpl.pages));
    localStorage.removeItem('editingDesign');
    localStorage.removeItem('cardNewsData');
    window.location.href = '/cardnews/editor';
  };

  const handleDeleteUserTemplate = async (id: string) => {
    if (!confirm('템플릿을 삭제하시겠습니까?')) return;
    setDeletingTemplateId(id);
    const supabase = createSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('user_templates').delete().eq('id', id).eq('user_id', user.id);
    setUserTemplates(prev => prev.filter(t => t.id !== id));
    setDeletingTemplateId(null);
  };

  const handleOpenDesign = (design: any) => {
    localStorage.setItem('editingDesign', JSON.stringify(design.pages_data));
    localStorage.setItem('editingDesignId', String(design.id));
    localStorage.removeItem('cardNewsData');
    window.location.href = `/cardnews/editor?id=${design.id}`;
  };

  const handleDeleteDesign = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await fetch(`/api/designs/${id}`, { method: 'DELETE' });
      setDesigns(prev => prev.filter(d => d.id !== id));
    } catch { /* ignore */ } finally {
      setDeletingId(null);
    }
  };

  // Tab: 예약 발행
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);
  const [cancellingPostId, setCancellingPostId] = useState<string | null>(null);

  // 예약 발행 모달
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulingDesign, setSchedulingDesign] = useState<any>(null);
  const [scheduleCaption, setScheduleCaption] = useState('');
  const [scheduleHashtags, setScheduleHashtags] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedHashtags, setCopiedHashtags] = useState(false);

  // 카로셀 슬라이드 캡처
  const [capturedSlideUrls, setCapturedSlideUrls] = useState<string[]>([]);
  const [isCapturingSlides, setIsCapturingSlides] = useState(false);
  const slideRenderRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // 생성기록 다운로드
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadingDesign, setDownloadingDesign] = useState<any>(null);
  const downloadRenderRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Instagram 연동
  const [igSettings, setIgSettings] = useState<{ ig_user_id: string; username: string } | null>(null);
  const [showIgSettingsModal, setShowIgSettingsModal] = useState(false);
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);
  const [igAccessToken, setIgAccessToken] = useState('');
  const [igUserId, setIgUserId] = useState('');
  const [isSavingIg, setIsSavingIg] = useState(false);
  const [igSaveError, setIgSaveError] = useState('');

  const fetchScheduledPosts = async () => {
    setIsLoadingScheduled(true);
    try {
      const res = await fetch('/api/scheduled-posts');
      const data = await res.json();
      if (data.posts) setScheduledPosts(data.posts);
    } catch { /* ignore */ } finally {
      setIsLoadingScheduled(false);
    }
  };

  const fetchIgSettings = async () => {
    try {
      const res = await fetch('/api/instagram/settings');
      const data = await res.json();
      if (data.settings) setIgSettings(data.settings);
      else setIgSettings(null);
    } catch { setIgSettings(null); }
  };

  // Tab: 성과 대시보드
  interface PostInsight {
    id: string;
    ig_post_id: string;
    design_name: string;
    thumbnail_url: string | null;
    caption: string;
    scheduled_at: string;
    permalink: string | null;
    like_count: number;
    comments_count: number;
    impressions: number;
    reach: number;
  }
  const [insights, setInsights] = useState<PostInsight[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState('');

  // Best posting time
  const [bestTimeData, setBestTimeData] = useState<{ slots: any[]; dayStats: any[]; totalPosts: number } | null>(null);
  const fetchBestTime = async () => {
    try {
      const res = await fetch('/api/insights/best-time');
      const data = await res.json();
      if (!data.error) setBestTimeData(data);
    } catch {}
  };

  const fetchInsights = async () => {
    setIsLoadingInsights(true);
    setInsightsError('');
    try {
      const res = await fetch('/api/instagram/insights');
      const data = await res.json();
      if (data.error) { setInsightsError(data.error); return; }
      if (data.insights) setInsights(data.insights);
    } catch { setInsightsError('불러오기 실패'); }
    finally { setIsLoadingInsights(false); }
  };

  useEffect(() => {
    if (activeTab === 'schedule') {
      fetchScheduledPosts();
      fetchIgSettings();
    }
    if (activeTab === 'analytics') {
      fetchInsights();
      fetchIgSettings();
      fetchBestTime();
    }
  }, [activeTab]);

  const handleSaveIgSettings = async () => {
    if (!igAccessToken.trim() || !igUserId.trim()) return;
    setIsSavingIg(true);
    setIgSaveError('');
    try {
      const res = await fetch('/api/instagram/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: igAccessToken.trim(), ig_user_id: igUserId.trim() }),
      });
      const data = await res.json();
      if (data.error) { setIgSaveError(data.error); return; }
      setIgSettings(data.settings);
      setShowIgSettingsModal(false);
      setIgAccessToken('');
      setIgUserId('');
    } catch { setIgSaveError('연결에 실패했습니다. 다시 시도해 주세요.'); }
    finally { setIsSavingIg(false); }
  };

  const handlePublishNow = async (post: any) => {
    setPublishingPostId(post.id);
    try {
      // slide_image_urls 우선, 없으면 thumbnail_url 폴백
      const imageUrls: string[] = (post.slide_image_urls?.length ? post.slide_image_urls : null)
        ?? (post.thumbnail_url ? [post.thumbnail_url] : []);
      const res = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          imageUrls,
          caption: post.caption,
          hashtags: post.hashtags,
        }),
      });
      const data = await res.json();
      if (data.error) { alert(`발행 실패: ${data.error}`); return; }
      setScheduledPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'published', ig_post_id: data.ig_post_id } : p));
    } catch { alert('발행 중 오류가 발생했습니다.'); }
    finally { setPublishingPostId(null); }
  };

  // 슬라이드 캡처 & Supabase Storage 업로드
  const captureAndUploadSlides = async (design: any): Promise<string[]> => {
    const pages: any[] = design.pages_data ?? [];
    if (pages.length === 0) return [];

    setIsCapturingSlides(true);
    setCapturedSlideUrls([]);

    // 폰트·이미지 로드 대기
    await new Promise(r => setTimeout(r, 1200));

    const urls: string[] = [];
    try {
      const h2c = (await import('html2canvas')).default;
      for (let i = 0; i < pages.length; i++) {
        const el = slideRenderRefs.current[i];
        if (!el) continue;
        try {
          const canvas = await h2c(el, { useCORS: true, allowTaint: true, scale: 2, width: 420, height: 525, logging: false });
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
          if (!blob) continue;

          const fd = new FormData();
          fd.append('file', blob, `slide_${i}.png`);
          const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
          const data = await res.json();
          if (data.url) urls.push(data.url);
          else if (pages[i].bgImage) urls.push(pages[i].bgImage); // 업로드 실패 시 bgImage 폴백
        } catch {
          if (pages[i].bgImage) urls.push(pages[i].bgImage);
        }
      }
    } catch {
      // html2canvas import 실패 시 bgImage 폴백
      for (const p of pages) { if (p.bgImage) urls.push(p.bgImage); }
    }

    setCapturedSlideUrls(urls);
    setIsCapturingSlides(false);
    return urls;
  };

  const handleOpenScheduleModal = async (design: any) => {
    setSchedulingDesign(design);
    setCapturedSlideUrls([]);
    setScheduleCaption('');
    setScheduleHashtags('');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduleDate(tomorrow.toISOString().split('T')[0]);
    setScheduleTime('09:00');
    setShowScheduleModal(true);
    // 캡션 자동 생성 + 슬라이드 캡처를 병렬로 실행
    captureAndUploadSlides(design);
    await handleGenerateCaption(design);
  };

  const handleGenerateCaption = async (design?: any) => {
    const target = design ?? schedulingDesign;
    if (!target) return;
    setIsGeneratingCaption(true);
    try {
      const slides = (target.pages_data ?? []).map((p: any) => ({
        title: p.title || '',
        body: [p.subtitle, ...(p.bullets ?? [])].filter(Boolean).join(' '),
      }));
      const res = await fetch('/api/generate/instagram-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides }),
      });
      const data = await res.json();
      if (data.caption) setScheduleCaption(data.caption);
      if (data.hashtags) setScheduleHashtags(data.hashtags);
    } catch { /* ignore */ } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleSchedulePost = async () => {
    if (!schedulingDesign || !scheduleCaption || !scheduleDate) return;
    setIsScheduling(true);
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      const firstPage = Array.isArray(schedulingDesign.pages_data) ? schedulingDesign.pages_data[0] : null;
      // 캡처된 슬라이드 URL 사용 (없으면 계속 캡처 시도)
      let slideUrls = capturedSlideUrls;
      if (slideUrls.length === 0 && isCapturingSlides) {
        // 아직 캡처 중이면 완료까지 대기
        slideUrls = await captureAndUploadSlides(schedulingDesign);
      }
      await fetch('/api/scheduled-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          design_id: schedulingDesign.id,
          design_name: schedulingDesign.name,
          thumbnail_url: slideUrls[0] ?? firstPage?.bgImage ?? null,
          slide_image_urls: slideUrls.length > 0 ? slideUrls : null,
          caption: scheduleCaption,
          hashtags: scheduleHashtags,
          scheduled_at: scheduledAt,
        }),
      });
      setShowScheduleModal(false);
      setActiveTab('schedule');
    } catch { /* ignore */ } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelPost = async (id: string) => {
    setCancellingPostId(id);
    try {
      await fetch(`/api/scheduled-posts/${id}`, { method: 'DELETE' });
      setScheduledPosts(prev => prev.filter(p => p.id !== id));
    } catch { /* ignore */ } finally {
      setCancellingPostId(null);
    }
  };

  const handleMarkPosted = async (id: string) => {
    try {
      await fetch(`/api/scheduled-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      setScheduledPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'published' } : p));
    } catch { /* ignore */ }
  };

  const copyToClipboard = (text: string, type: 'caption' | 'hashtags') => {
    navigator.clipboard.writeText(text);
    if (type === 'caption') { setCopiedCaption(true); setTimeout(() => setCopiedCaption(false), 2000); }
    else { setCopiedHashtags(true); setTimeout(() => setCopiedHashtags(false), 2000); }
  };

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState('');

  const handleStartWithTemplate = async (t: any) => {
    setSelectedTemplate(t);

    if (t.pages && Array.isArray(t.pages)) {
      localStorage.setItem('cardnews_import_templates', JSON.stringify(t.pages));
      localStorage.removeItem('editingDesign');
      localStorage.removeItem('cardNewsData');
      window.location.href = '/cardnews/editor';
      return;
    }

    // 이미 생성되었거나 입력된 내용이 있다면 템플릿 예시로 덮어쓰지 않고, 템플릿 맞춤 요약 진행
    if (prompt.trim() !== '') {
      setIsSummarizing(true);
      try {
        const res = await fetch('/api/generate/fit-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalText: prompt,
            templateTitle: t.title,
            slideCount: slideCountType === 'auto' ? 'auto' : slideCountNumber
          })
        });
        const data = await res.json();
        if (data.text) {
          setPrompt(data.text);
        } else {
          alert('요약 중 오류가 발생했습니다.');
        }
      } catch(e) {
        alert('요약 서버와 통신할 수 없습니다.');
      }
      setIsSummarizing(false);
      setStep(2);
      return;
    }

    setStep(2);

    // 템플릿에 따른 예시 프롬프트 자동 채우기
    let examplePrompt = '';
    const titleStr = t?.title?.toLowerCase() || '';
    const categoryStr = t?.category?.toLowerCase() || '';
    
    if (categoryStr.includes('공간') || categoryStr.includes('인테리어') || titleStr.includes('place') || titleStr.includes('공간')) {
      examplePrompt = `일하고 싶어지는 공간, 스페이스 모노 🏠\n\n✨ 공간 특징\n- 자연광이 가득한 통창\n- 프리미엄 허먼밀러 의자\n- 무제한 커피 & 간식\n- 24시간 자유 이용\n\n📍 위치\n서울 성수동 서울숲길 17\n\n💰 멤버십\n- 자유석 월 25만원`;
    } else if (categoryStr.includes('음악') || titleStr.includes('music') || titleStr.includes('playlist') || titleStr.includes('플리')) {
      examplePrompt = `비 오는 날, 방구석에서 듣기 좋은 인디 플리 🎧\n\n1. 잔나비 - 주저하는 연인들을 위해\n2. 검정치마 - EVERYTHING\n3. 백예린 - Square\n4. 혁오 - TOMBOY\n\n여러분의 최애 비 오는 날 노래는 무엇인가요? 댓글로 알려주세요!`;
    } else if (categoryStr.includes('비즈니스') || categoryStr.includes('마케팅') || titleStr.includes('트렌드') || titleStr.includes('trend')) {
      examplePrompt = `매출을 200% 올리는 마케팅 전략 📈\n\n1. 타겟 고객의 페르소나 명확히 하기\n2. A/B 테스트로 전환율 최적화\n3. 이메일 자동화 퍼널 구축\n4. 고객 리뷰와 소셜 프루프 활용\n\n오늘 당장 적용해 볼 전략은 무엇인가요?`;
    } else {
      examplePrompt = `${t.title} 주제의 카드뉴스 기획안\n\n[표지]\n시선을 사로잡는 메인 카피\n\n[본문 1]\n첫 번째 핵심 내용 및 설명\n\n[본문 2]\n두 번째 핵심 내용 및 예시\n\n[결론]\n요약 및 팔로우/저장 유도 액션`;
    }
    setPrompt(examplePrompt);
  };

  const handleTagClick = (tag: string) => {
    if (inputMode === 'trend') {
      setTrendInput(tag);
      return;
    }

    let text = '';
    if (tag === '공간 소개') {
      text = `프리미엄 워크스페이스, 라운지 넥스트 🏢\n\n✨ 공간 특징\n- 눈이 편안한 간접 조명과 플랜테리어\n- 전 좌석 모션 데스크 & 에어론 체어 세팅\n- 집중을 위한 1인용 폰부스와 미팅룸 완비\n- 바리스타가 직접 내리는 스페셜티 커피 제공\n\n📍 위치\n강남구 테헤란로 123, 15층 (강남역 도보 3분)\n\n💰 멤버십 안내\n- 자유석: 월 30만원\n- 1인 프라이빗 오피스: 월 60만원\n- 원데이 패스: 2.5만원\n\n🎁 신규 등록 이벤트\n첫 달 30% 할인 및 웰컴 굿즈 패키지 증정!\n\n📞 투어 예약 및 문의\n프로필 하단 링크를 통해 예약해주세요.`;
    } else if (tag === '숨은 카페 추천') {
      text = `망원동 골목길, 나만 알고 싶은 아지트 카페 ☕\n\n🏠 우드 앤 브루 (Wood & Brew)\n오래된 주택을 개조한 따뜻한 우드톤 인테리어\n조용하게 책 읽기 좋은 아늑한 분위기\n\n☕ 시그니처 메뉴\n- 시나몬 크림 라떼 6,500원\n- 수제 바질 토마토 에이드 7,000원\n- 글루텐프리 쑥 갸또 6,500원\n\n📍 위치\n마포구 망원로 4길 12, 골목 안쪽\n\n⏰ 영업시간\n화~일 11:00 - 21:00\n(매주 월요일 정기 휴무)\n\n💡 꿀팁\n- 주말엔 웨이팅이 있으니 평일 오후 방문 추천\n- 반려동물 동반 가능 (테라스 좌석)\n- 망원시장 공영주차장 이용\n\n#망원동카페 #감성카페 #디저트맛집`;
    } else if (tag === '제주도 핫플 5곳') {
      text = `실패 없는 제주도 동쪽 감성 사진 스팟 BEST 5 🌴\n\n1️⃣ 안돌오름 비밀의 숲\n- 편백나무 숲길 사이로 들어오는 햇살이 예술!\n- 맑은 날 오전에 방문하면 인생샷 보장\n\n2️⃣ 코난해변\n- 아직 많이 알려지지 않은 에메랄드빛 투명한 바다\n- 피크닉 매트 하나면 여기가 바로 천국 🌊\n\n3️⃣ 송당 무끈모루\n- 액자 뷰 프레임으로 유명한 들판 포토존\n- 해 질 녘 노을과 함께 찍으면 그림 같은 풍경\n\n4️⃣ 보롬왓\n- 계절마다 수국, 메밀꽃, 튤립이 끝없이 펼쳐지는 곳\n- 광활한 꽃밭 한가운데서 동화 속 주인공 되기 🌸\n\n5️⃣ 스누피가든\n- 아기자기한 캐릭터와 자연의 완벽한 조화\n- 실내외 볼거리가 많아 비 오는 날에도 강력 추천\n\n💡 저장해두고 다음 제주 여행 때 꼭 방문해 보세요!`;
    } else if (tag === '마케팅 전략') {
      text = `0원에서 시작하는 찐팬 만드는 브랜딩 전략 4가지 📈\n\n1. 뾰족한 타겟팅으로 시작하기\n모두를 만족시키려 하지 마세요.\n단 100명의 열광적인 팬을 만드는 것이 핵심입니다.\n\n2. 비하인드 스토리 공유하기\n완벽한 결과물보다 '과정'을 보여주세요.\n고객은 브랜드의 성장 스토리에 공감하고 응원하게 됩니다.\n\n3. 양방향 소통 채널 구축\n단방향 전달이 아닌, 의견을 묻고 피드백을 반영하세요.\n인스타그램 스토리, 오픈채팅방 등을 적극 활용해보세요.\n\n4. 일관된 브랜드 보이스 유지\n시각적 디자인뿐만 아니라 '말투'와 '메시지'도 중요합니다.\n브랜드만의 페르소나를 명확히 설정하세요.\n\n🔥 우리 브랜드에 부족한 점은 무엇인가요?\n댓글로 고민을 남겨주시면 피드백해 드립니다!`;
    } else if (tag === '서비스 제안서') {
      text = `B2B 콜드메일 성공률을 3배 높이는 제안서 작성법 🤝\n\n1. 문제점 짚어주기 (Pain Point)\n고객사가 현재 겪고 있을 구체적인 문제를 먼저 언급하세요.\n"요즘 신규 리드 확보에 어려움을 겪고 계시지 않나요?"\n\n2. 해결책 제시 (Solution)\n우리 서비스가 그 문제를 어떻게 해결해줄 수 있는지\n간결하고 직관적인 한 문장으로 정의하세요.\n\n3. 명확한 숫자와 레퍼런스 (Proof)\n"매출 상승"이라는 모호한 말 대신,\n"A사는 도입 후 3개월 만에 전환율 45% 증가"라고 숫자로 증명하세요.\n\n4. 부담 없는 콜투액션 (CTA)\n"계약하시죠"가 아니라 "15분 줌 미팅 어떠신가요?"로\n허들을 낮춰 다음 스텝을 제안하세요.\n\n💡 핵심은 '우리 자랑'이 아닌 '고객의 이익'에 초점을 맞추는 것입니다.\n👉 프로필 링크에서 무료 제안서 템플릿을 다운로드하세요!`;
    } else if (tag === '비 오는 날 플리') {
      text = `새벽 감성 가득, 비 오는 날 듣기 좋은 R&B 팝 플리 🎧\n\n창밖으로 떨어지는 빗소리와 함께,\n따뜻한 커피 한 잔 마시며 듣기 좋은 플레이리스트입니다.\n\n1. Daniel Caesar - Get You\n부드럽고 몽환적인 보컬이 비 오는 날과 찰떡!\n\n2. Bruno Major - Nothing\n잔잔한 기타 선율과 로맨틱한 가사에 마음이 몽글몽글해져요.\n\n3. Mac Ayres - Easy\n그루비하면서도 편안한 무드, 작업할 때 노동요로 최고 💻\n\n4. HONNE - Day 1 ◑\n비 오는 우울함을 살짝 덜어줄 기분 좋은 리듬감\n\n5. Tom Misch - Movie\n재즈 풍의 멜로디와 독특한 음색이 빗소리와 완벽한 하모니 ☔\n\n👇 여러분이 가장 좋아하는 비 오는 날 플레이리스트는 무엇인가요?`;
    } else if (tag === '주간 트렌드') {
      text = `기획자가 꼭 알아야 할 이번 주 숏폼 콘텐츠 트렌드 📱\n\n🔥 HOT 트렌드\n'디토(Ditto) 소비'의 진화\n이제는 인플루언서가 아닌, 나와 결이 맞는 '마이크로 취향'을 따라 소비한다!\n\n💡 숏폼 포맷 트렌드\n- POV (1인칭 시점) 영상의 폭발적 증가\n- 대사 없이 ASMR과 시각적 효과만으로 승부하는 힐링 숏폼 인기\n- 정보 전달은 무조건 '3초 안에' 후킹하기\n\n📊 소셜 미디어 인사이트\n인스타그램 알고리즘 업데이트:\n팔로워 수보다 '공유'와 '저장' 지표가 도달률에 미치는 영향이 더 커졌습니다.\n\n🎯 기획 적용 포인트\n단순히 예쁜 영상보다, "친구에게 카톡으로 공유하고 싶은"\n실용적이고 공감 가는 콘텐츠 기획이 필수!\n\n✅ 다음 주 트렌드도 놓치지 않으려면 팔로우 꾹 눌러주세요!`;
    } else {
      text = `${tag}에 대한 카드뉴스 기획안 초안을 작성해주세요.\n\n[여기에 세부 내용을 작성하세요]`;
    }
    setPrompt(text);
  };

  const fetchTrendRecommendations = async () => {
    setIsFetchingTrends(true);
    try {
      const res = await fetch('/api/generate/recommend-trends');
      const data = await res.json();
      if (data.trends) setTrendRecommendations(data.trends);
    } catch {
      // Fallback
      setTrendRecommendations(['2026 부동산', 'AI 자동화', '인기 카페', '주간 경제', 'MZ 트렌드']);
    } finally {
      setIsFetchingTrends(false);
    }
  };

  const handleSuggestTopics = async () => {
    if (!step9Input.trim() && !step9Category) {
      alert('자유 입력 또는 카테고리를 선택해주세요.');
      return;
    }
    setIsSuggestingTopics(true);
    setStep9Topics([]);
    try {
      const res = await fetch('/api/generate/topic-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: step9Input, category: step9Category, recency: step9Recency }),
      });
      const data = await res.json();
      if (data.topics) setStep9Topics(data.topics);
      else alert(data.error || '주제 추천에 실패했습니다.');
    } catch {
      alert('주제 추천 중 오류가 발생했습니다.');
    } finally {
      setIsSuggestingTopics(false);
    }
  };

  const handleSmartGenerate = async () => {
    if (!smartKeyword.trim()) return;
    setSmartGenerating(true);
    setSmartStep('주제 분석 중...');
    try {
      const steps = ['주제 분석 중...', '슬라이드 기획 중...', '콘텐츠 작성 중...', '이미지 검색 중...'];
      let si = 0;
      const stepTimer = setInterval(() => {
        si = (si + 1) % steps.length;
        setSmartStep(steps[si]);
      }, 2000);

      const res = await fetch('/api/generate/smart-cardnews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          keyword: smartKeyword, 
          category: smartCategory, 
          slideCount: smartSlideCount,
          personaId: selectedPersonaId
        }),
      });
      clearInterval(stepTimer);

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSmartStep('에디터 준비 중...');
      localStorage.removeItem('editingDesign');
      localStorage.removeItem('cardnews_autosave');
      localStorage.removeItem('cardNewsData');
      localStorage.setItem('cardnews_import_templates', JSON.stringify(data.pages));
      window.location.href = '/cardnews/editor';
    } catch (e: any) {
      alert('생성 실패: ' + friendlyError(e));
    } finally {
      setSmartGenerating(false);
      setSmartStep('');
    }
  };

  const handleGenerateUnified = async (type: 'url' | 'trend' | 'text' | 'step9') => {
    setIsGenerating(true);
    try {
      const body: any = {};
      if (type === 'url') body.url = urlInput;
      else if (type === 'trend') body.originalText = trendInput;
      else if (type === 'step9') body.originalText = step9SelectedTopic;
      else body.originalText = prompt;
      body.templateTitle = selectedTemplate?.title || '';
      if (type === 'step9') {
        body.slideCount = slideCountType === 'auto' ? 'auto' : slideCountNumber;
        body.ratio = selectedRatio;
        body.genStyle = genStyle;
      } else {
        body.slideCount = quickSlideAuto ? 'auto' : slideCountNumber;
      }

      const res = await fetch('/api/generate/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (data.cardNews) {
        const validThemes = ['business', 'cafe', 'lifestyle', 'travel', 'fashion', 'food', 'education'];
        if (data.themeKey && validThemes.includes(data.themeKey)) {
          setAiRecommendedStyle(data.themeKey);
          setUseAiStyle(true);
        } else {
          setAiRecommendedStyle(null);
          setUseAiStyle(false);
        }

        // 브랜드 핸들 결정
        const activePersona = personas.find(p => p.id === selectedPersonaId) || personas[0];
        const activeBrandName = activePersona?.brand_name || '@aptshowhome';

        // 배경 이미지 자동 매칭 (Unsplash API 호출)
        const updatedCardNews = await Promise.all(data.cardNews.map(async (card: any, idx: number) => {
          let bgUrl = '';
          try {
            const imgRes = await fetch(`/api/images/search?query=${encodeURIComponent(card.imageKeyword)}`);
            const imgData = await imgRes.json();
            bgUrl = imgData.imageUrl || '';
          } catch (e) {
            bgUrl = '';
          }

          const finalBlocks = Array.isArray(card.blocks) && card.blocks.length > 0
            ? card.blocks
            : [{ type: 'headline', text: card.title || '제목' }];

          return { 
            ...card, 
            backgroundImage: bgUrl,
            accent: brandKit.useAutoAccent ? brandKit.color : undefined,
            blocks: finalBlocks,
            brandTone: card.brandTone === 'sage' ? 'sage' : 'gold',
            showFrame: card.showFrame !== undefined ? card.showFrame : true,
            handle: card.handle || activeBrandName,
            overlay: card.overlay || 'linear-gradient(to top, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.40) 100%)',
            blocksOffsetY: card.blocksOffsetY !== undefined ? card.blocksOffsetY : (idx === 0 ? 78 : 90),
          };
        }));

        // 카드뉴스 텍스트 포맷팅 (기획안 확인용 텍스트)
        const formattedText = updatedCardNews.map((c: any) => `[${c.page}장 ${c.page === 1 ? '표지' : '본문'}]\n${c.title}\n${c.body}`).join('\n\n');
        setPrompt(formattedText);
        setGeneratedBlogPost(data.blogPost);
        setViralHooks(data.viralHooks);
        
        // 에디터에서 바로 쓸 수 있도록 구조화된 원본 데이터 저장 (배경 이미지 포함)
        localStorage.setItem('cardNewsData', JSON.stringify(updatedCardNews));
        localStorage.setItem('cardNewsBlog', data.blogPost || '');
        localStorage.setItem('cardNewsHooks', JSON.stringify(data.viralHooks || []));
        localStorage.setItem('cardNewsDraft', formattedText); // 에디터 초기값 호환용
        localStorage.removeItem('editingDesign'); // 새로운 생성 시 이전 편집 기록 삭제

        if (type !== 'text') setInputMode('text');
        setStep(2); // 기획안 확인 단계로 이동
      } else {
        alert('생성에 실패했습니다: ' + friendlyError(data.error || '알 수 없는 오류'));
      }
    } catch (e) {
      alert('생성 중 오류가 발생했습니다.');
    }
    setIsGenerating(false);
  };

  const handleGenerateFromUrl = () => handleGenerateUnified('url');
  const handleGenerateFromTrend = () => handleGenerateUnified('trend');

  const handleConvertToBlog = () => {
    if (!generatedBlogPost) {
      alert('먼저 카드뉴스를 생성해주세요.');
      return;
    }
    
    let images: string[] = [];
    try {
      const rawData = localStorage.getItem('cardNewsData');
      if (rawData) {
        const parsed = JSON.parse(rawData);
        if (Array.isArray(parsed)) {
          images = parsed
            .map((item: any) => item.backgroundImage || item.bgImage || '')
            .filter((url: string) => url.trim() !== '');
        }
      }
    } catch (e) {
      console.error('Failed to parse cardNewsData for blog conversion:', e);
    }
    
    localStorage.setItem('convertSourceBlog', JSON.stringify({
      content: generatedBlogPost,
      images: images,
    }));
    
    router.push('/blog-generator?from=cardnews');
  };

  const renderStepper = (steps: string[], currentStep: number) => {
    return (
      <div className="flex justify-center items-center py-8">
        {steps.map((title, i) => {
          const num = i + 1;
          const isActive = currentStep >= num;
          const isCurrent = currentStep === num;
          return (
            <div key={num} className="flex items-center">
              <div className="flex flex-col items-center gap-2 relative">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  isActive ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {isActive && !isCurrent && num < currentStep ? '✓' : num}
                </div>
                <span className={`absolute top-10 text-xs whitespace-nowrap ${isCurrent ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
                  {title}
                </span>
              </div>
              {num < steps.length && (
                <div className={`w-16 h-[2px] mx-2 transition-colors ${currentStep > num ? 'bg-primary-600' : 'bg-gray-100'}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-full bg-white relative">
      {/* 오프스크린: 슬라이드 캡처용 렌더 영역 (카로셀 예약용) */}
      {showScheduleModal && schedulingDesign && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
          {typeof window !== 'undefined' && !document.getElementById('gf-carousel-capture') && (() => {
            const link = document.createElement('link');
            link.id = 'gf-carousel-capture';
            link.rel = 'stylesheet';
            link.href = CAPTURE_FONTS_URL;
            document.head.appendChild(link);
            return null;
          })()}
          {(schedulingDesign.pages_data ?? []).map((page: any, i: number) => (
            <div key={i} ref={el => { slideRenderRefs.current[i] = el; }}>
              <SlideCapture page={page} />
            </div>
          ))}
        </div>
      )}

      {/* 오프스크린: 다운로드 캡처용 렌더 영역 */}
      {showDownloadModal && downloadingDesign && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
          {(downloadingDesign.pages_data ?? []).map((page: any, i: number) => (
            <div key={i} ref={el => { downloadRenderRefs.current[i] = el; }}>
              <SlideCapture page={page} />
            </div>
          ))}
        </div>
      )}

      {/* Top Banner */}
      <div className="flex justify-between items-center px-4 md:px-6 py-3 bg-white border-b border-gray-100">
        <div className="text-primary-600 font-semibold text-xs flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary-600" /> 무료 체험 D-2
        </div>
        <div className="flex gap-1.5 md:gap-2">
          <button className="hidden sm:flex px-3 py-1.5 text-xs font-semibold text-gray-600 bg-yellow-50 border border-yellow-100 rounded-md items-center gap-1">
            <span className="text-yellow-500">⭐</span> 퀘스트 0/3
          </button>
          <button className="hidden md:flex px-3 py-1.5 text-xs font-semibold text-primary-600 bg-primary-50 border border-primary-100 rounded-md items-center gap-1">
            <MessageSquare size={14} /> 1:1 온보딩
          </button>
          <button className="px-3 py-1.5 text-xs font-bold bg-primary-600 text-white rounded-md hover:bg-primary-700 shadow-sm">연동하기</button>
          <button className="hidden sm:block px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">요금제</button>
        </div>
      </div>

      <div className="px-4 md:px-10 py-4 md:py-6 max-w-[1200px] mx-auto w-full">
        {/* Main Tabs — 모바일 스크롤 */}
        <div className="flex gap-1.5 md:gap-2 bg-gray-50/50 p-1.5 rounded-2xl mb-4 border border-gray-100 overflow-x-auto scrollbar-hide">

          {([
            { id: 'create', label: '카드뉴스 생성', sub: '템플릿으로 콘텐츠 생성' },
            { id: 'learn', label: '브랜드 키트', sub: '로고·색상 설정' },
            { id: 'history', label: '생성기록', sub: null },
            { id: 'schedule', label: '예약 발행', sub: 'Instagram 일정 관리' },
            { id: 'analytics', label: '성과 분석', sub: '게시물 통계' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-3 md:px-6 py-2.5 md:py-3 rounded-xl flex flex-col items-start transition-all ${activeTab === tab.id ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <span className="text-xs md:text-sm font-bold whitespace-nowrap">{tab.label}</span>
              {tab.sub && <span className="hidden md:block text-[11px] text-gray-400 font-medium">{tab.sub}</span>}
            </button>
          ))}
        </div>

        {/* --- 탭: 브랜드 키트 --- */}
        {activeTab === 'learn' && (
          <div>
            <div className="flex items-center justify-between mb-6 mt-2">
              <div>
                <h2 className="text-lg font-bold text-gray-800">나만의 브랜드 키트 (Brand Kit)</h2>
                <p className="text-sm text-gray-400 mt-0.5">로고와 브랜드 색상을 설정하여 모든 작업물에 자동 적용하세요</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 md:gap-8">
              {/* Left: Brand Settings */}
              <div className="space-y-6">
                {/* Brand Name */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <label className="block text-sm font-bold text-gray-700 mb-3">브랜드 / 서비스 명</label>
                  <input
                    type="text"
                    value={brandKit.name}
                    onChange={(e) => updateBrandKit({ name: e.target.value })}
                    placeholder="예: 안티그래비티 테크"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
                  />
                </div>

                {/* Brand Logo Upload */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <label className="block text-sm font-bold text-gray-700 mb-3">브랜드 로고</label>
                  <div className="flex items-start gap-6">
                    <div className="relative w-32 h-32 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden group">
                      {brandKit.logo ? (
                        <>
                          <img src={brandKit.logo} className="w-full h-full object-contain p-2" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button onClick={() => updateBrandKit({ logo: '' })} className="text-white text-xs font-bold bg-red-500 px-2 py-1 rounded">삭제</button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <UploadCloud size={24} className="text-gray-300 mx-auto mb-2" />
                          <span className="text-[10px] text-gray-400 font-medium">PNG/JPG</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => updateBrandKit({ logo: ev.target?.result as string });
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 text-sm text-gray-500 space-y-2 pt-2">
                      <p>• 가급적 배경이 없는 **투명 PNG**를 권장합니다.</p>
                      <p>• 카드뉴스 오른쪽 상단에 작게 표시됩니다.</p>
                      <p>• 가로형 로고가 가장 예쁘게 보입니다.</p>
                    </div>
                  </div>
                </div>

                {/* Brand Color */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <label className="block text-sm font-bold text-gray-700 mb-4">브랜드 포인트 컬러</label>
                  <div className="flex items-center gap-6">
                    <input
                      type="color"
                      value={brandKit.color}
                      onChange={(e) => updateBrandKit({ color: e.target.value })}
                      className="w-16 h-16 rounded-xl cursor-pointer border-none p-0 overflow-hidden"
                    />
                    <div className="flex-1">
                      <input
                        type="text"
                        value={brandKit.color}
                        onChange={(e) => updateBrandKit({ color: e.target.value })}
                        className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono uppercase mb-2"
                      />
                      <p className="text-xs text-gray-400">제목의 강조선, 불렛 포인트 등에 적용되는 메인 색상입니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Preview & Options */}
              <div className="space-y-6">
                <div className="bg-gray-900 rounded-2xl p-8 text-white relative overflow-hidden h-[300px] flex flex-col justify-center">
                  {/* Mock Preview */}
                  <div className="absolute top-6 right-6 opacity-80">
                    {brandKit.logo ? (
                      <img src={brandKit.logo} className="h-6 object-contain" />
                    ) : (
                      <div className="text-[10px] font-bold border border-white/30 px-2 py-1 rounded">LOGO</div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="w-12 h-1 rounded-full" style={{ backgroundColor: brandKit.color }} />
                    <h3 className="text-2xl font-black leading-tight">우리 브랜드만의<br />일관된 디자인</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandKit.color }} />
                      <p className="text-sm text-white/60">자동으로 로고와 색상이 적용됩니다.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-700">생성 시 자동 적용</h3>
                      <p className="text-xs text-gray-400">카드뉴스 생성 시 브랜드 색상을 기본으로 사용합니다.</p>
                    </div>
                    <button 
                      className={`w-10 h-6 rounded-full p-1 transition-colors relative shrink-0 ${brandKit.useAutoAccent ? 'bg-primary-600' : 'bg-gray-200'}`}
                      onClick={() => updateBrandKit({ useAutoAccent: !brandKit.useAutoAccent })}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${brandKit.useAutoAccent ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <button className="w-full py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                    설정 초기화
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 탭: 생성기록 --- */}
        {activeTab === 'history' && (
          <div className="space-y-10">

            {/* ─── 내 템플릿 (Supabase) ──────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-4 mt-2">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">⭐ 내 템플릿</h2>
                  <p className="text-sm text-gray-400 mt-0.5">에디터에서 "템플릿 저장"한 레이아웃 · 공유하면 커뮤니티에 공개됩니다</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* JSON 가져오기 */}
                  <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleImportFromFile} />
                  <button
                    onClick={() => importFileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <Upload size={12} /> JSON 가져오기
                  </button>
                  <button onClick={fetchUserTemplates} disabled={isLoadingTemplates} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">
                    <RefreshCw size={12} className={isLoadingTemplates ? 'animate-spin' : ''} /> 새로고침
                  </button>
                </div>
              </div>

              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
              ) : userTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 border-2 border-dashed border-violet-100 rounded-2xl bg-violet-50/30">
                  <div className="text-3xl mb-2">⭐</div>
                  <p className="text-sm font-semibold text-gray-500">저장된 템플릿이 없습니다</p>
                  <p className="text-[12px] text-gray-400 mt-1">에디터 상단 "템플릿 저장" 버튼으로 저장하세요</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {userTemplates.map(tpl => {
                    const firstPage = tpl.pages?.[0] || null;
                    return (
                      <div key={tpl.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                        <div
                          className="relative bg-gray-900 overflow-hidden cursor-pointer"
                          style={{ height: 140 }}
                          onClick={() => handleUseTemplate(tpl)}
                        >
                          <MiniCardPreview page={firstPage} />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full shadow">
                              편집 시작
                            </div>
                          </div>
                          <div className="absolute top-2 left-2 bg-violet-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {tpl.category}
                          </div>
                          <div className="absolute top-2 right-2 flex items-center gap-1">
                            {tpl.is_public && (
                              <span className="bg-emerald-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <Globe size={8} /> 공개
                              </span>
                            )}
                            <span className="bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {tpl.pages?.length || 0}장
                            </span>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="font-bold text-xs text-gray-800 truncate mb-0.5">{tpl.name}</p>
                          <p className="text-[10px] text-gray-400 mb-2">{new Date(tpl.created_at).toLocaleDateString('ko-KR')}</p>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleUseTemplate(tpl)}
                              className="flex-1 py-1.5 text-[11px] font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                            >
                              사용하기
                            </button>
                            {/* 공유 토글 */}
                            <button
                              onClick={() => handleTogglePublic(tpl)}
                              disabled={togglingPublicId === tpl.id}
                              title={tpl.is_public ? '커뮤니티 공유 중단' : '커뮤니티에 공유'}
                              className={`w-7 h-7 rounded-lg border flex items-center justify-center disabled:opacity-40 transition-colors ${tpl.is_public ? 'border-emerald-200 text-emerald-500 bg-emerald-50 hover:bg-emerald-100' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                            >
                              {togglingPublicId === tpl.id ? <Loader2 size={10} className="animate-spin" /> : tpl.is_public ? <Globe size={11} /> : <Lock size={11} />}
                            </button>
                            {/* JSON 내보내기 */}
                            <button
                              onClick={() => handleExportTemplate(tpl)}
                              title="JSON으로 내보내기"
                              className="w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center transition-colors"
                            >
                              <Download size={11} />
                            </button>
                            {/* 삭제 */}
                            <button
                              onClick={() => handleDeleteUserTemplate(tpl.id)}
                              disabled={deletingTemplateId === tpl.id}
                              className="w-7 h-7 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 flex items-center justify-center disabled:opacity-40"
                            >
                              {deletingTemplateId === tpl.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── 커뮤니티 템플릿 ──────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Users size={18} className="text-emerald-500" /> 커뮤니티 템플릿
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5">다른 사용자가 공유한 템플릿 · 클릭하면 바로 편집 가능</p>
                </div>
                <button onClick={fetchCommunityTemplates} disabled={isLoadingCommunity} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">
                  <RefreshCw size={12} className={isLoadingCommunity ? 'animate-spin' : ''} /> 새로고침
                </button>
              </div>

              {isLoadingCommunity ? (
                <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
              ) : communityTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 border-2 border-dashed border-emerald-100 rounded-2xl bg-emerald-50/20">
                  <Users size={28} className="text-emerald-200 mb-2" />
                  <p className="text-sm font-semibold text-gray-500">아직 공유된 템플릿이 없습니다</p>
                  <p className="text-[12px] text-gray-400 mt-1">내 템플릿의 <Globe size={10} className="inline" /> 버튼을 눌러 커뮤니티에 공유해보세요</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {communityTemplates.map(tpl => {
                    const firstPage = tpl.pages?.[0] || null;
                    return (
                      <div key={tpl.id} className="bg-white border border-emerald-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                        <div
                          className="relative bg-gray-900 overflow-hidden cursor-pointer"
                          style={{ height: 140 }}
                          onClick={() => handleUseCommunityTemplate(tpl)}
                        >
                          <MiniCardPreview page={firstPage} />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full shadow">
                              {usingCommunityId === tpl.id ? '불러오는 중...' : '편집 시작'}
                            </div>
                          </div>
                          <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {tpl.category}
                          </div>
                          <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {tpl.pages?.length || 0}장
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="font-bold text-xs text-gray-800 truncate mb-0.5">{tpl.name}</p>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] text-gray-400 truncate">{tpl.author_email?.split('@')[0] || '익명'}</p>
                            {(tpl.use_count || 0) > 0 && (
                              <span className="text-[10px] text-gray-400">{tpl.use_count}회 사용</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleUseCommunityTemplate(tpl)}
                            disabled={usingCommunityId === tpl.id}
                            className="w-full py-1.5 text-[11px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {usingCommunityId === tpl.id ? <Loader2 size={10} className="animate-spin" /> : null}
                            이 템플릿 사용하기
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── 내 카드뉴스 (로컬 저장) ─────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-4 mt-2">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">내 카드뉴스</h2>
                  <p className="text-sm text-gray-400 mt-0.5">에디터에서 "내 카드뉴스 저장"한 작업물</p>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-semibold">이 기기에만 저장됨</span>
              </div>

              {savedCardNews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
                  <div className="text-4xl mb-3">🗂️</div>
                  <p className="text-sm font-semibold text-gray-500">아직 저장된 카드뉴스가 없습니다</p>
                  <p className="text-[12px] text-gray-400 mt-1">에디터 상단 "내 카드뉴스 저장" 버튼으로 저장하세요</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {savedCardNews.map(cn => {
                    const firstPage = cn.pages[0] || null;
                    const slideCount = cn.pages.length;
                    const createdAt = cn.createdAt
                      ? new Date(cn.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
                      : '';
                    return (
                      <div key={cn.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                        <div
                          className="relative bg-gray-900 overflow-hidden cursor-pointer"
                          style={{ height: 176 }}
                          onClick={() => handleOpenLocalCardNews(cn)}
                        >
                          <MiniCardPreview page={firstPage} />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full shadow flex items-center gap-1.5">
                              <Pencil size={11} /> 편집하기
                            </div>
                          </div>
                          <div className="absolute top-2.5 right-2.5 bg-black/60 text-white text-[11px] font-bold px-2 py-0.5 rounded-full z-10">
                            {slideCount}장
                          </div>
                          {slideCount > 1 && (
                            <div className="absolute bottom-0 left-0 right-0 flex gap-0.5 px-1.5 pb-1.5 pt-4 bg-gradient-to-t from-black/60 to-transparent z-10">
                              {cn.pages.slice(0, 6).map((pg: any, i: number) => (
                                <div key={i} style={{ flex: 1, height: 18, borderRadius: 2, overflow: 'hidden', background: '#333', border: '1px solid rgba(255,255,255,0.2)' }}>
                                  {pg.bgImage && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={pg.bgImage.replace('w=800', 'w=60')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} loading="lazy" />
                                  )}
                                </div>
                              ))}
                              {slideCount > 6 && (
                                <div style={{ width: 18, height: 18, borderRadius: 2, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>+{slideCount - 6}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="p-3.5">
                          <h3 className="font-bold text-sm text-gray-800 truncate mb-0.5">{cn.name}</h3>
                          <p className="text-[11px] text-gray-400 mb-3">{createdAt}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenLocalCardNews(cn)}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                            >
                              <Pencil size={12} /> 편집
                            </button>
                            <button
                              onClick={() => handleDeleteLocalCardNews(cn.id)}
                              disabled={deletingLocalId === cn.id}
                              className="flex items-center justify-center w-9 h-9 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                              title="삭제"
                            >
                              {deletingLocalId === cn.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── 카드뉴스 생성기록 (Supabase) ──────────────────────────── */}
            <div>
            <div className="flex items-center justify-between mb-6 mt-2">
              <div>
                <h2 className="text-lg font-bold text-gray-800">카드뉴스 생성기록</h2>
                <p className="text-sm text-gray-400 mt-0.5">저장된 카드뉴스를 불러와 다시 편집하세요</p>
              </div>
              <button
                onClick={fetchDesigns}
                disabled={isLoadingDesigns}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isLoadingDesigns ? 'animate-spin' : ''} />
                새로고침
              </button>
            </div>

            {isLoadingDesigns ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <Loader2 size={32} className="animate-spin mb-3" />
                <p className="text-sm">불러오는 중...</p>
              </div>
            ) : designs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
                <div className="text-5xl mb-4">🗂️</div>
                <p className="text-base font-semibold text-gray-500">저장된 카드뉴스가 없습니다</p>
                <p className="text-sm text-gray-400 mt-1">에디터에서 저장하면 여기에 기록이 쌓입니다</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-6 px-6 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700"
                >
                  카드뉴스 만들기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
                {designs.map((design) => {
                  const pages: any[] = Array.isArray(design.pages_data) ? design.pages_data : [];
                  const firstPage = pages[0] || null;
                  const slideCount = pages.length;
                  const createdAt = design.created_at
                    ? new Date(design.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
                    : '';
                  const isConfirmingDelete = confirmDeleteId === design.id;
                  return (
                    <div key={design.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                      {/* Thumbnail — full card preview */}
                      <div
                        className="relative bg-gray-900 overflow-hidden cursor-pointer"
                        style={{ height: 176 }}
                        onClick={() => handleOpenDesign(design)}
                      >
                        <MiniCardPreview page={firstPage} />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full shadow flex items-center gap-1.5">
                            <Pencil size={11} /> 편집하기
                          </div>
                        </div>
                        {/* Slide count badge */}
                        <div className="absolute top-2.5 right-2.5 bg-black/60 text-white text-[11px] font-bold px-2 py-0.5 rounded-full z-10">
                          {slideCount}장
                        </div>
                        {/* Multi-slide strip */}
                        {slideCount > 1 && (
                          <div className="absolute bottom-0 left-0 right-0 flex gap-0.5 px-1.5 pb-1.5 pt-4 bg-gradient-to-t from-black/60 to-transparent z-10">
                            {pages.slice(0, 6).map((pg: any, i: number) => (
                              <div key={i} style={{ flex: 1, height: 18, borderRadius: 2, overflow: 'hidden', background: '#333', border: '1px solid rgba(255,255,255,0.2)' }}>
                                {pg.bgImage && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={pg.bgImage.replace('w=800', 'w=60')}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
                                    loading="lazy"
                                  />
                                )}
                              </div>
                            ))}
                            {slideCount > 6 && (
                              <div style={{ width: 18, height: 18, borderRadius: 2, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>+{slideCount - 6}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3.5">
                        <h3 className="font-bold text-sm text-gray-800 truncate mb-0.5">{design.name}</h3>
                        <p className="text-[11px] text-gray-400 mb-3">{createdAt}</p>

                        {/* Delete confirmation inline */}
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-2 p-2.5 bg-red-50 rounded-xl border border-red-100">
                            <p className="flex-1 text-xs text-red-600 font-medium">삭제하시겠습니까?</p>
                            <button
                              onClick={() => handleDeleteDesign(design.id)}
                              disabled={deletingId === design.id}
                              className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
                            >
                              {deletingId === design.id ? <Loader2 size={10} className="animate-spin" /> : null}
                              삭제
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 border border-gray-200 text-xs font-semibold text-gray-600 rounded-lg hover:bg-gray-50"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          /* Actions */
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenDesign(design)}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                            >
                              <Pencil size={12} />
                              편집
                            </button>
                            <button
                              onClick={() => handleOpenScheduleModal(design)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold border border-[#E1306C]/30 text-[#E1306C] rounded-lg hover:bg-[#E1306C]/5 transition-colors"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                              예약 발행
                            </button>
                            <button
                              onClick={() => { setDownloadingDesign(design); setShowDownloadModal(true); }}
                              className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                              title="다운로드"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(design.id)}
                              disabled={deletingId === design.id}
                              className="flex items-center justify-center w-9 h-9 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                              title="삭제"
                            >
                              {deletingId === design.id
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Trash2 size={14} />
                              }
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        )}

        {/* --- 탭: 예약 발행 --- */}
        {/* --- 탭: 성과 대시보드 --- */}
        {activeTab === 'analytics' && (
          <div>
            <div className="flex items-center justify-between mb-4 mt-2">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Instagram 성과 대시보드</h2>
                <p className="text-sm text-gray-400 mt-0.5">발행된 게시물의 좋아요·댓글·도달 수를 확인하세요</p>
              </div>
              <button
                onClick={fetchInsights}
                disabled={isLoadingInsights}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isLoadingInsights ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Instagram 연동 상태 */}
            {!igSettings && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-5 bg-orange-50 border border-orange-200">
                <div className="flex items-center gap-2.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#ea580c"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  <p className="text-sm font-semibold text-orange-800">Instagram 미연결 — 연동 후 성과를 확인할 수 있습니다</p>
                </div>
                <button
                  onClick={() => { setActiveTab('schedule'); setShowIgSettingsModal(true); }}
                  className="px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-[#ea580c]"
                >
                  연동하기
                </button>
              </div>
            )}

            {isLoadingInsights ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <Loader2 size={32} className="animate-spin mb-3" />
                <p className="text-sm">Instagram 데이터를 불러오는 중...</p>
              </div>
            ) : insightsError ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
                <div className="text-5xl mb-4">⚠️</div>
                <p className="text-base font-semibold text-gray-500">{insightsError}</p>
                <p className="text-sm text-gray-400 mt-1">Instagram 연동 설정을 확인해 주세요</p>
              </div>
            ) : insights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-base font-semibold text-gray-500">발행된 게시물이 없습니다</p>
                <p className="text-sm text-gray-400 mt-1">Instagram에 게시된 카드뉴스가 있으면 성과를 확인할 수 있습니다</p>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className="mt-6 px-6 py-2.5 bg-gradient-to-r from-[#E1306C] to-[#833AB4] text-white text-sm font-bold rounded-xl"
                >
                  예약 발행 탭으로 이동
                </button>
              </div>
            ) : (
              <>
                {/* Summary stat cards */}
                {(() => {
                  const totalLikes = insights.reduce((s, i) => s + i.like_count, 0);
                  const totalComments = insights.reduce((s, i) => s + i.comments_count, 0);
                  const totalImpressions = insights.reduce((s, i) => s + i.impressions, 0);
                  const totalReach = insights.reduce((s, i) => s + i.reach, 0);
                  const fmtNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
                  return (
                    <div className="grid grid-cols-4 gap-3 mb-6">
                      {[
                        { label: '총 게시물', value: String(insights.length), icon: '🖼️', color: 'bg-purple-50 border-purple-100', textColor: 'text-purple-700' },
                        { label: '총 좋아요', value: fmtNum(totalLikes), icon: '❤️', color: 'bg-red-50 border-red-100', textColor: 'text-red-600' },
                        { label: '총 댓글', value: fmtNum(totalComments), icon: '💬', color: 'bg-blue-50 border-blue-100', textColor: 'text-blue-600' },
                        { label: '총 도달', value: fmtNum(totalReach || totalImpressions), icon: '👀', color: 'bg-green-50 border-green-100', textColor: 'text-green-600' },
                      ].map(card => (
                        <div key={card.label} className={`${card.color} border rounded-2xl p-4 flex flex-col gap-1`}>
                          <span className="text-xl">{card.icon}</span>
                          <span className={`text-2xl font-black ${card.textColor}`}>{card.value}</span>
                          <span className="text-xs text-gray-500 font-medium">{card.label}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* 차트 섹션 */}
                {insights.length >= 2 && (
                  <InsightBarChart insights={insights} />
                )}

                {/* 최적 발행 시간 */}
                {bestTimeData && bestTimeData.totalPosts > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-800">최적 발행 시간 추천</p>
                        <p className="text-xs text-gray-400">{bestTimeData.totalPosts}개 게시물 발행 이력 분석</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                      {bestTimeData.slots.slice(0, 3).map((slot: any, i: number) => (
                        <div key={slot.hour} className={`rounded-xl p-3 border ${i === 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                            <span className={`text-xl font-black ${i === 0 ? 'text-amber-600' : 'text-gray-700'}`}>{slot.label}</span>
                          </div>
                          <p className="text-xs text-gray-500">{slot.days.join(', ')} · {slot.count}회 발행</p>
                          {i === 0 && <p className="text-[10px] text-amber-600 font-bold mt-1">✨ 가장 자주 발행한 시간대</p>}
                        </div>
                      ))}
                    </div>
                    {/* 요일별 막대 */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2">요일별 발행 빈도</p>
                      <div className="flex gap-2 items-end h-12">
                        {bestTimeData.dayStats.map((d: any) => {
                          const max = Math.max(...bestTimeData.dayStats.map((x: any) => x.count), 1);
                          const h = Math.max(4, Math.round((d.count / max) * 48));
                          return (
                            <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                              <div className="w-full rounded-t-sm bg-amber-400" style={{ height: `${h}px`, minHeight: 4 }} title={`${d.count}회`} />
                              <span className="text-[10px] text-gray-400 font-medium">{d.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Per-post list */}
                <div className="space-y-3">
                  {insights.map(post => {
                    const dateStr = new Date(post.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
                    const engRate = post.reach > 0
                      ? (((post.like_count + post.comments_count) / post.reach) * 100).toFixed(1)
                      : null;
                    return (
                      <div key={post.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex gap-4 items-center hover:shadow-sm transition-shadow">
                        {/* Thumbnail */}
                        <div className="w-14 h-[70px] rounded-xl overflow-hidden bg-gray-100 shrink-0">
                          {post.thumbnail_url ? (
                            <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl">🖼️</div>
                          )}
                        </div>

                        {/* Caption + date */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-400 mb-0.5">{post.design_name} · {dateStr}</p>
                          <p className="text-sm text-gray-700 line-clamp-2">{post.caption}</p>
                          {post.permalink && (
                            <a href={post.permalink} target="_blank" rel="noreferrer" className="text-[11px] text-[#E1306C] font-semibold mt-1 inline-block hover:underline">
                              Instagram에서 보기 →
                            </a>
                          )}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-center">
                            <span className="text-lg font-black text-red-500">{post.like_count >= 1000 ? `${(post.like_count / 1000).toFixed(1)}k` : post.like_count}</span>
                            <span className="text-[10px] text-gray-400 font-medium">❤️ 좋아요</span>
                          </div>
                          <div className="w-px h-8 bg-gray-100" />
                          <div className="flex flex-col items-center">
                            <span className="text-lg font-black text-blue-500">{post.comments_count}</span>
                            <span className="text-[10px] text-gray-400 font-medium">💬 댓글</span>
                          </div>
                          <div className="w-px h-8 bg-gray-100" />
                          <div className="flex flex-col items-center">
                            <span className="text-lg font-black text-green-600">{post.reach >= 1000 ? `${(post.reach / 1000).toFixed(1)}k` : post.reach || post.impressions}</span>
                            <span className="text-[10px] text-gray-400 font-medium">👀 도달</span>
                          </div>
                          {engRate && (
                            <>
                              <div className="w-px h-8 bg-gray-100" />
                              <div className="flex flex-col items-center">
                                <span className="text-lg font-black text-purple-600">{engRate}%</span>
                                <span className="text-[10px] text-gray-400 font-medium">🎯 참여율</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div>
            <div className="flex items-center justify-between mb-4 mt-2">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Instagram 예약 발행</h2>
                <p className="text-sm text-gray-400 mt-0.5">예약된 게시물을 관리하고 발행 여부를 추적하세요</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchScheduledPosts}
                  disabled={isLoadingScheduled}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isLoadingScheduled ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Instagram 연동 상태 배너 */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl mb-5 ${igSettings ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
              <div className="flex items-center gap-2.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill={igSettings ? '#16a34a' : '#ea580c'}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                <div>
                  {igSettings ? (
                    <p className="text-sm font-semibold text-green-800">@{igSettings.username} 연결됨</p>
                  ) : (
                    <p className="text-sm font-semibold text-orange-800">Instagram 미연결</p>
                  )}
                  <p className="text-[11px] text-gray-500 mt-0.5">{igSettings ? '즉시 발행 버튼으로 게시할 수 있습니다' : '연동 후 즉시 발행이 가능합니다'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowIgSettingsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-colors"
                style={{ background: igSettings ? '#16a34a' : '#ea580c' }}
              >
                <Settings size={12} />
                {igSettings ? '재연동' : '연동하기'}
              </button>
            </div>

            {isLoadingScheduled ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <Loader2 size={32} className="animate-spin mb-3" />
                <p className="text-sm">불러오는 중...</p>
              </div>
            ) : scheduledPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
                <div className="text-5xl mb-4">📅</div>
                <p className="text-base font-semibold text-gray-500">예약된 게시물이 없습니다</p>
                <p className="text-sm text-gray-400 mt-1">생성기록 탭에서 카드뉴스를 선택해 예약하세요</p>
                <button
                  onClick={() => setActiveTab('history')}
                  className="mt-6 px-6 py-2.5 bg-[#E1306C] text-white text-sm font-bold rounded-xl hover:bg-[#c8245c] transition-colors"
                >
                  생성기록 보기
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledPosts.map(post => {
                  const scheduledDate = new Date(post.scheduled_at);
                  const isOverdue = scheduledDate < new Date() && post.status === 'pending';
                  const dateStr = scheduledDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
                  const timeStr = scheduledDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={post.id} className={`bg-white border rounded-2xl p-4 flex gap-4 items-start ${isOverdue ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100'}`}>
                      {/* Thumbnail */}
                      <div className="w-16 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                        {post.thumbnail_url ? (
                          <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">🖼️</div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            post.status === 'published' ? 'bg-green-100 text-green-700'
                            : isOverdue ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                          }`}>
                            {post.status === 'published' ? '✓ 발행 완료' : isOverdue ? '⚠ 발행 대기' : '⏰ 예약 중'}
                          </span>
                          {post.slide_image_urls?.length > 1 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                              <Images size={9} /> {post.slide_image_urls.length}장 카로셀
                            </span>
                          )}
                          <span className="text-xs text-gray-400">{post.design_name}</span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2 mb-2">{post.caption}</p>
                        {/* 슬라이드 스트립 (카로셀인 경우) */}
                        {post.slide_image_urls?.length > 1 && (
                          <div className="flex gap-1 mb-2 overflow-x-auto">
                            {post.slide_image_urls.slice(0, 6).map((url: string, i: number) => (
                              <div key={i} className="shrink-0 rounded overflow-hidden border border-gray-100" style={{ width: 28, height: 35 }}>
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </div>
                            ))}
                            {post.slide_image_urls.length > 6 && (
                              <div className="shrink-0 rounded bg-gray-100 flex items-center justify-center border border-gray-100" style={{ width: 28, height: 35 }}>
                                <span className="text-[9px] font-bold text-gray-400">+{post.slide_image_urls.length - 6}</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-[11px] text-gray-400">
                          <span className="flex items-center gap-1"><Calendar size={11} /> {dateStr}</span>
                          <span className="flex items-center gap-1"><Clock size={11} /> {timeStr}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        {post.status !== 'published' && igSettings && (
                          <button
                            onClick={() => handlePublishNow(post)}
                            disabled={publishingPostId === post.id}
                            className="px-3 py-1.5 text-[11px] font-bold bg-gradient-to-r from-[#E1306C] to-[#833AB4] text-white rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-40 flex items-center gap-1"
                          >
                            {publishingPostId === post.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                            즉시 발행
                          </button>
                        )}
                        {post.status !== 'published' && (
                          <button
                            onClick={() => handleMarkPosted(post.id)}
                            className="px-3 py-1.5 text-[11px] font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                          >
                            발행 완료
                          </button>
                        )}
                        {post.status === 'published' && post.ig_post_id && (
                          <div className="px-2 py-1 text-[10px] text-green-600 font-medium text-center">✓ IG 게시됨</div>
                        )}
                        <button
                          onClick={() => handleCancelPost(post.id)}
                          disabled={cancellingPostId === post.id}
                          className="px-3 py-1.5 text-[11px] font-bold border border-red-100 text-red-400 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap disabled:opacity-40"
                        >
                          {cancellingPostId === post.id ? <Loader2 size={11} className="animate-spin mx-auto" /> : '삭제'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- 탭: 카드뉴스 생성 --- */}
        {activeTab === 'create' && (
          <div>
            {renderStepper(['디자인 선택', '콘텐츠 입력', '장별 기획', '결과 확인'], step)}

            {/* Step 1: 디자인 선택 (템플릿 갤러리) */}
            {step === 1 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-8 text-gray-500 font-semibold cursor-pointer hover:text-gray-800 transition-colors w-fit">
                  <ChevronLeft size={18} /> <span>다른 방법으로 시작하기</span>
                </div>

                <div className="flex gap-3 mb-6 border-b border-gray-100 overflow-x-auto">
                  <button
                    onClick={() => setInputMode('text')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${inputMode === 'text' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  >📝 텍스트로 시작</button>
                  <button
                    onClick={() => setInputMode('url')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${inputMode === 'url' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  >🔗 기사 URL로 시작</button>
                  <button
                    onClick={() => setInputMode('trend')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${inputMode === 'trend' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  >🔍 키워드 트렌드로 시작</button>
                  <button
                    onClick={() => setInputMode('smart')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 ${inputMode === 'smart' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  ><Wand2 size={14} /> AI 완전 자동 생성</button>
                  <button
                    onClick={() => setInputMode('step9')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 ${inputMode === 'step9' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  >✨ 9단계 정밀 제작</button>
                </div>

                {inputMode === 'text' && (
                  <>
                    <div className="mb-6">
                      <span className="text-xs font-semibold text-gray-400 block mb-3">이런 주제는 어때요?</span>
                      <div className="flex gap-2 flex-wrap">
                        {recommendationTags.map(tag => (
                          <button 
                            key={tag} 
                            onClick={() => handleTagClick(tag)}
                            className="px-4 py-2 rounded-full border border-gray-200 text-[13px] text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors bg-white font-medium shadow-sm hover:shadow-md"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Freeform Quick Input */}
                    <div suppressHydrationWarning className="border border-gray-200 rounded-2xl bg-white p-6 mb-12 shadow-sm relative focus-within:border-primary-500 transition-colors focus-within:shadow-md">
                      <textarea 
                        className="w-full h-64 text-[15px] resize-none outline-none placeholder:text-gray-300 leading-relaxed"
                        placeholder="만들고 싶은 주제를 입력하세요 (예: 마케팅 강의, 카페 소개)"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                      <div className="border-t border-gray-100 pt-4 mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button className="text-sm text-gray-500 font-medium flex items-center gap-1 hover:text-gray-800 transition-colors">
                        <ImagePlus size={16} /> 내 이미지 사용
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">0/5,000</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">이미지 비율</span>
                        <div className="flex bg-gray-100 rounded-md p-0.5">
                          {['1:1', '4:5', '9:16', '16:9', '3:4'].map(r => (
                            <button 
                              key={r} 
                              onClick={() => setSelectedRatio(r)}
                              className={`px-2 py-1 text-[11px] rounded transition-colors ${r === selectedRatio ? 'bg-primary-600 text-white font-bold shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">장 수</span>
                        <div className="flex bg-gray-100 rounded-md p-0.5 items-center">
                          <button 
                            onClick={() => setQuickSlideAuto(true)}
                            className={`px-2 py-1 text-[11px] rounded transition-colors ${quickSlideAuto ? 'bg-primary-600 text-white font-bold shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                          >
                            자동
                          </button>
                          <span className="text-gray-300 mx-1">-</span>
                          
                          <button 
                            onClick={() => {
                              setQuickSlideAuto(false);
                              if (slideCountNumber > 1) setSlideCountNumber(slideCountNumber - 1);
                            }}
                            className="px-1 text-gray-500 hover:text-gray-800"
                          >-</button>
                          <span className={`text-[11px] font-bold px-1 w-4 text-center ${!quickSlideAuto ? 'text-primary-700' : 'text-gray-600'}`}>
                            {quickSlideAuto ? 'A' : slideCountNumber}
                          </span>
                          <button 
                            onClick={() => {
                              setQuickSlideAuto(false);
                              if (slideCountNumber < 10) setSlideCountNumber(slideCountNumber + 1);
                            }}
                            className="px-1 text-gray-500 hover:text-gray-800"
                          >+</button>
                          
                          <span className="text-gray-500 text-[11px] mr-1">장</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleGenerateUnified('text')}
                        disabled={isGenerating || !prompt}
                        className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-2 rounded-lg transition-colors disabled:bg-gray-300"
                      >
                        {isGenerating ? '생성 중...' : '✨ 카드뉴스 생성'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
              )}

                {inputMode === 'url' && (
                  <div className="border border-gray-200 rounded-2xl bg-white p-6 mb-12 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-2">기사 URL로 카드뉴스 만들기</h3>
                    <p className="text-sm text-gray-500 mb-6">참고할 뉴스 기사나 블로그 포스팅의 URL을 입력하면 AI가 핵심 내용을 요약해줍니다.</p>
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        placeholder="https://..." 
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      />
                      <button 
                        onClick={handleGenerateFromUrl}
                        disabled={isGenerating || !urlInput}
                        className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-8 py-3 rounded-xl disabled:bg-gray-300 transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        {isGenerating ? '분석 중...' : '불러오기'}
                      </button>
                    </div>
                  </div>
                )}

                {inputMode === 'trend' && (
                  <div className="space-y-6">
                    {/* Trend Recommendation Section */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-400 block">AI가 추천하는 지금 가장 핫한 주제</span>
                        <button 
                          onClick={fetchTrendRecommendations}
                          disabled={isFetchingTrends}
                          className="text-[11px] font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                          {isFetchingTrends ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          추천 주제 새로고침
                        </button>
                      </div>
                      <div className="flex gap-2 flex-wrap min-h-[40px]">
                        {trendRecommendations.length > 0 ? (
                          trendRecommendations.map(tag => (
                            <button 
                              key={tag} 
                              onClick={() => {
                                setTrendInput(tag);
                                // 바로 생성 단계로 넘어가고 싶어할 수 있으므로 입력값만 채워줌
                              }}
                              className={`px-4 py-2 rounded-full border text-[13px] transition-all font-medium shadow-sm hover:shadow-md ${trendInput === tag ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-primary-400 hover:text-primary-600 bg-white'}`}
                            >
                              {tag}
                            </button>
                          ))
                        ) : (
                          <div className="w-full py-4 border border-dashed border-gray-100 rounded-xl flex items-center justify-center bg-gray-50/30">
                            <button 
                              onClick={fetchTrendRecommendations}
                              className="text-xs text-gray-400 font-medium hover:text-primary-500 transition-colors"
                            >
                              ✨ 클릭하여 추천 주제를 불러오세요
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-2xl bg-white p-6 mb-12 shadow-sm focus-within:border-primary-500 transition-colors">
                      <h3 className="font-bold text-gray-800 mb-2">직접 키워드 입력하기</h3>
                      <p className="text-sm text-gray-500 mb-6">관심 있는 키워드를 직접 입력하거나 위에서 주제를 선택하세요.</p>
                      <div className="flex gap-3">
                        <input 
                          type="text" 
                          value={trendInput}
                          onChange={e => setTrendInput(e.target.value)}
                          placeholder="예: 2026 아파트 시장, 숏폼 트렌드" 
                          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                        <button 
                          onClick={handleGenerateFromTrend}
                          disabled={isGenerating || !trendInput}
                          className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-8 py-3 rounded-xl disabled:bg-gray-300 transition-colors flex items-center gap-2 whitespace-nowrap"
                        >
                          {isGenerating ? '검색 중...' : '✨ 트렌드 수집 및 생성'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {inputMode === 'smart' && (
                  <div className="space-y-5">
                    {/* 헤더 */}
                    <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles size={18} />
                        <p className="font-black text-base">AI 완전 자동 카드뉴스</p>
                      </div>
                      <p className="text-violet-200 text-xs">키워드 하나만 입력하면 AI가 기획·작성·이미지까지 7장을 완성합니다</p>
                    </div>

                    {/* 카테고리 선택 */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2">카테고리</p>
                      <div className="flex flex-wrap gap-2">
                        {['부동산', '세금/금융', '재테크', '비즈니스', '라이프스타일', '건강', '교육', 'IT/트렌드'].map(cat => (
                          <button key={cat} onClick={() => setSmartCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${smartCategory === cat ? 'bg-violet-600 text-white border-violet-600 shadow-md' : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600 bg-white'}`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 브랜드 페르소나 선택 */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2">적용할 브랜드 페르소나</p>
                      {personas.length === 0 ? (
                        <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3.5 border border-gray-200 flex items-center justify-between shadow-sm">
                          <span>보관된 페르소나가 없습니다. 기본 페르소나(@aptshowhome)로 생성됩니다.</span>
                          <button
                            type="button"
                            onClick={() => router.push('/persona')}
                            className="text-violet-600 hover:text-violet-700 font-bold ml-2 underline transition-all shrink-0"
                          >
                            설정하러 가기
                          </button>
                        </div>
                      ) : (
                        <select
                          value={selectedPersonaId || ''}
                          onChange={e => setSelectedPersonaId(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 bg-white cursor-pointer shadow-sm hover:border-violet-300 transition-colors"
                        >
                          {personas.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.persona_name || p.brand_name} (@{p.brand_name})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* 키워드 입력 */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2">주제 키워드</p>
                      <div className="flex gap-2">
                        <input
                          type="text" value={smartKeyword}
                          onChange={e => setSmartKeyword(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !smartGenerating && handleSmartGenerate()}
                          placeholder="예: 다주택자 양도세, 전세사기 예방, 금리 인상"
                          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
                        />
                        <button onClick={handleSmartGenerate}
                          disabled={smartGenerating || !smartKeyword.trim()}
                          className="px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm disabled:opacity-40 transition-all flex items-center gap-2 whitespace-nowrap shadow-md">
                          {smartGenerating
                            ? <><Loader2 size={15} className="animate-spin" />{smartStep}</>
                            : <><Sparkles size={15} />AI 생성</>}
                        </button>
                      </div>
                      {/* 추천 키워드 */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {(smartCategory === '부동산' ? ['다주택자 양도세', '재건축 투자 전략', '전세사기 예방법', '청약 당첨 꿀팁', '아파트 시세 분석'] :
                          smartCategory === '세금/금융' ? ['종합소득세 절세', '금융소득 분리과세', '연말정산 전략', '상속세 개편', '증여세 줄이기'] :
                          smartCategory === '재테크' ? ['월급쟁이 재테크', 'ETF 투자 입문', '배당주 포트폴리오', '달러 환전 타이밍', '적금 vs 펀드'] :
                          ['AI 자동화 트렌드', '사이드잡 수익화', '디지털 노마드 준비', '온라인 창업 아이템', '소셜미디어 마케팅']
                        ).map(kw => (
                          <button key={kw} onClick={() => setSmartKeyword(kw)}
                            className="text-[11px] px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-full text-gray-600 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600 transition-colors">
                            {kw}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 슬라이드 수 */}
                    <div className="flex items-center gap-4">
                      <p className="text-xs font-bold text-gray-500">슬라이드 수</p>
                      <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                        {[5, 6, 7, 8, 9, 10].map(n => (
                          <button key={n} onClick={() => setSmartSlideCount(n)}
                            className={`w-8 h-7 rounded-lg text-xs font-bold transition-all ${smartSlideCount === n ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">장</span>
                    </div>

                    {/* 생성 단계 안내 */}
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {[
                        { icon: '🔍', label: '주제 분석', desc: 'AI 앵글 선택' },
                        { icon: '📋', label: '슬라이드 기획', desc: '구조 자동 설계' },
                        { icon: '✍️', label: '콘텐츠 작성', desc: '제목·본문 생성' },
                        { icon: '🎨', label: '에디터 오픈', desc: '바로 편집 시작' },
                      ].map(s => (
                        <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                          <div className="text-lg mb-1">{s.icon}</div>
                          <p className="text-[10px] font-bold text-gray-700">{s.label}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">{s.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {inputMode === 'step9' && (
                  <div className="space-y-4">
                    {/* 1단계: 큰틀 선택 */}
                    <div>
                      <label className="text-sm font-bold text-gray-700 mb-2 block">1단계. 어떤 카드뉴스를 만들까요?</label>
                      <input
                        type="text"
                        value={step9Input}
                        onChange={e => setStep9Input(e.target.value)}
                        placeholder="예: 오늘 부동산 이슈 찾아줘 / 3기 신도시 관련 / 자유롭게 입력"
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>
                    {/* 카테고리 버튼 */}
                    <div>
                      <span className="text-xs text-gray-400 mb-2 block">또는 카테고리만 선택</span>
                      <div className="flex flex-wrap gap-2">
                        {['부동산', '경제', '라이프스타일', '마케팅', '자기계발', '기술'].map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setStep9Category(step9Category === cat ? '' : cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${step9Category === cat ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300'}`}
                          >{cat}</button>
                        ))}
                      </div>
                    </div>
                    {/* 최신성 필터 */}
                    <div>
                      <span className="text-xs text-gray-400 mb-2 block">최신성</span>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { value: 'today', label: '오늘' },
                          { value: 'week', label: '이번 주' },
                          { value: 'month', label: '이번 달' },
                          { value: 'evergreen', label: '상시' }
                        ] as const).map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStep9Recency(opt.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${step9Recency === opt.value ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                          >{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    {/* 주제 추천 버튼 */}
                    <button
                      type="button"
                      onClick={handleSuggestTopics}
                      disabled={isSuggestingTopics}
                      className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all"
                    >{isSuggestingTopics ? '주제 찾는 중...' : '✨ 주제 추천받기'}</button>
                    {/* 2단계: 주제 후보 표시 */}
                    {step9Topics.length > 0 && (
                      <div className="pt-2">
                        <label className="text-sm font-bold text-gray-700 mb-2 block">2단계. 마음에 드는 주제를 고르세요</label>
                        <div className="space-y-2">
                          {step9Topics.map((topic, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setStep9SelectedTopic(topic)}
                              className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${step9SelectedTopic === topic ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold' : 'border-gray-200 text-gray-600 hover:border-emerald-300'}`}
                            >{topic}</button>
                          ))}
                        </div>
                        {step9SelectedTopic && (
                          <>
                            {/* 7단계 상세 설정 */}
                            <div className="mt-4 p-4 border border-gray-200 rounded-2xl bg-gray-50/50 space-y-4 shadow-sm text-left">
                              <div className="flex items-center gap-1.5 border-b border-gray-100 pb-2 mb-2">
                                <span className="text-sm font-bold text-gray-800">⚙️ 7단계 상세 설정</span>
                              </div>

                              {/* 1. 슬라이드 장수 */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-700">슬라이드 장수</span>
                                  <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                                    <button
                                      type="button"
                                      onClick={() => setSlideCountType('auto')}
                                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                        slideCountType === 'auto'
                                          ? 'bg-white text-gray-800 shadow-sm border border-gray-200/50'
                                          : 'text-gray-500 hover:text-gray-800'
                                      }`}
                                    >
                                      자동
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSlideCountType('manual')}
                                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                        slideCountType === 'manual'
                                          ? 'bg-white text-gray-800 shadow-sm border border-gray-200/50'
                                          : 'text-gray-500 hover:text-gray-800'
                                      }`}
                                    >
                                      직접 지정
                                    </button>
                                  </div>
                                </div>
                                {slideCountType === 'manual' && (
                                  <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                                    <span className="text-[11px] text-gray-400 font-medium">수량 설정 (1~10장)</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (slideCountNumber > 1) setSlideCountNumber(slideCountNumber - 1);
                                        }}
                                        className="w-6 h-6 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"
                                      >
                                        -
                                      </button>
                                      <span className="text-xs font-bold text-gray-700 w-4 text-center">{slideCountNumber}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (slideCountNumber < 10) setSlideCountNumber(slideCountNumber + 1);
                                        }}
                                        className="w-6 h-6 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"
                                      >
                                        +
                                      </button>
                                      <span className="text-[11px] text-gray-400">장</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 2. 이미지 비율 */}
                              <div className="space-y-2">
                                <span className="text-xs font-semibold text-gray-700 block">이미지 비율</span>
                                <div className="flex flex-wrap gap-1.5 bg-gray-100 p-0.5 rounded-lg border border-gray-200 w-fit">
                                  {['4:5', '9:16', '1:1'].map(r => (
                                    <button
                                      key={r}
                                      type="button"
                                      onClick={() => setSelectedRatio(r)}
                                      className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                        selectedRatio === r
                                          ? 'bg-white text-gray-800 shadow-sm border border-gray-200/50'
                                          : 'text-gray-500 hover:bg-gray-200'
                                      }`}
                                    >
                                      {r}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* 3. 생성 스타일 */}
                              <div className="space-y-2">
                                <span className="text-xs font-semibold text-gray-700 block">생성 스타일</span>
                                <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 w-fit">
                                  <button
                                    type="button"
                                    onClick={() => setGenStyle('free')}
                                    className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                      genStyle === 'free'
                                        ? 'bg-white text-gray-800 shadow-sm border border-gray-200/50'
                                        : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                  >
                                    자유롭게 변형
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setGenStyle('origin')}
                                    className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                      genStyle === 'origin'
                                        ? 'bg-white text-gray-800 shadow-sm border border-gray-200/50'
                                        : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                  >
                                    원본 유지
                                  </button>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleGenerateUnified('step9')}
                              disabled={isGenerating}
                              className="w-full mt-3 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all"
                            >
                              {isGenerating ? '카드뉴스 생성 중...' : '✨ 이 주제로 카드뉴스 만들기'}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center mb-4">
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <RefreshCw size={14} /> 나만의 스타일 학습
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="px-4 py-1.5 text-sm font-semibold border border-primary-200 text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                    >
                      + 템플릿 추가 (Figma)
                    </button>
                  </div>
                </div>

                {/* Category Filter */}
                {(() => {
                  const templatesWithoutFakeMyTemplate = templates.filter(t => t.category !== '내 템플릿');
                  
                  const myMappedTemplates = userTemplates.map(ut => {
                    const firstPage = ut.pages?.[0] || null;
                    return {
                      id: ut.id,
                      title: ut.name,
                      category: '내 템플릿',
                      ratio: firstPage?.ratio || '4:5',
                      isFavorite: false,
                      image: firstPage?.bgImage || 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=500&q=80',
                      pages: ut.pages,
                      isDbTemplate: true,
                    };
                  });

                  const rawCategories = Array.from(new Set(templatesWithoutFakeMyTemplate.map(t => t.category).filter(Boolean)));
                  const categories = ['전체', '내 템플릿', ...rawCategories.filter(c => c !== '내 템플릿')];

                  let filtered;
                  if (activeCategory === '내 템플릿') {
                    filtered = myMappedTemplates;
                  } else if (activeCategory === '전체') {
                    filtered = [...myMappedTemplates, ...templatesWithoutFakeMyTemplate];
                  } else {
                    filtered = templatesWithoutFakeMyTemplate.filter(t => t.category === activeCategory);
                  }
                  
                  return (
                    <>
                      <div className="flex gap-2 flex-wrap mb-5">
                        {categories.map(cat => (
                          <button
                            key={cat}
                            onClick={() => { setActiveCategory(cat); setVisibleTemplateCount(8); }}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${activeCategory === cat ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {/* Template Grid */}
                      {activeCategory === '내 템플릿' && filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 bg-white border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 w-full col-span-full">
                          <div className="text-4xl mb-3">🔒</div>
                          <p className="text-sm font-semibold text-gray-500">저장된 내 템플릿이 없습니다</p>
                          <p className="text-xs mt-1 text-gray-400 text-center">
                            에디터 화면 우측 상단에서 "템플릿 저장" 버튼으로 나만의 디자인을 저장해 보세요.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                          {filtered.slice(0, visibleTemplateCount).map(t => (
                          <div key={t.id} className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-all border border-gray-100 bg-white">
                            <div className="relative aspect-[4/5]">
                              <img src={t.image} className="w-full h-full object-cover" alt={t.title} />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                  onClick={() => handleStartWithTemplate(t)}
                                  className="bg-white/20 backdrop-blur-md border border-white/50 text-white font-bold py-2 px-6 rounded-full hover:bg-white/30 transition-colors"
                                >
                                  이 템플릿 사용
                                </button>
                              </div>
                              <div className="absolute top-3 left-3 flex items-center gap-1">
                                {t.isFavorite && <div className="bg-yellow-400 text-white text-[10px] px-1.5 py-0.5 rounded-sm shadow-sm font-black">⭐</div>}
                                <div className="bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-sm font-bold">{t.ratio}</div>
                              </div>
                            </div>
                            <div className="px-3 py-2.5">
                              <p className="text-xs font-bold text-gray-700 truncate">{t.title}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{t.category}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                      {visibleTemplateCount < filtered.length && (
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => setVisibleTemplateCount(c => c + 8)}
                            className="flex items-center gap-2 px-8 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                          >
                            <ChevronDown size={16} />
                            더보기 ({filtered.length - visibleTemplateCount}개 남음)
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Step 2: 콘텐츠 입력 상세 (좌우 분할) */}
            {step === 2 && (
              <div className="mt-8">
                {/* 선택된 템플릿 바너 */}
                <div className="flex justify-between items-center bg-white border border-gray-100 rounded-xl p-3 mb-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center border border-primary-100">
                      <span className="text-primary-600 font-bold text-lg">🎨</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-400 font-bold">선택된 템플릿</span>
                      <h3 className="font-bold text-sm text-gray-800">{selectedTemplate?.title || 'Nature-Inspired Productivity Series'}</h3>
                    </div>
                  </div>
                  <button onClick={() => setStep(1)} className="text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                    <RefreshCw size={12} /> 디자인 변경
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 md:gap-6">
                  {/* Left: Input Textarea & Image Upload */}
                  <div className="flex flex-col gap-4 h-full">
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col flex-1 min-h-[500px]">
                      <div className="flex justify-between items-center mb-4 border-b border-gray-100">
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setResultTab('card')}
                            className={`pb-2 text-sm font-bold transition-colors border-b-2 ${resultTab === 'card' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400'}`}
                          >🎴 카드뉴스 기획안</button>
                          <button 
                            onClick={() => setResultTab('blog')}
                            className={`pb-2 text-sm font-bold transition-colors border-b-2 ${resultTab === 'blog' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400'}`}
                          >📝 블로그 포스팅</button>
                        </div>
                        {resultTab === 'blog' && (
                          <div className="flex gap-3">
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(generatedBlogPost);
                                alert('블로그 글이 클립보드에 복사되었습니다.');
                              }}
                              className="text-xs font-bold text-primary-600 hover:underline"
                            >복사하기</button>
                            <button 
                              onClick={handleConvertToBlog}
                              className="text-xs font-bold text-primary-600 hover:underline"
                            >블로그로 전환 →</button>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 relative overflow-y-auto pr-2">
                        {resultTab === 'card' ? (
                          <textarea 
                            className="w-full h-full resize-none outline-none text-[15px] leading-relaxed text-gray-700 placeholder:text-gray-300"
                            placeholder="카드뉴스에 들어갈 내용을 자유롭게 작성해주세요."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                          />
                        ) : (
                          <div className="text-[14px] leading-relaxed text-gray-700 whitespace-pre-wrap font-medium bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                            {generatedBlogPost || '블로그 포스팅 내용이 아직 생성되지 않았습니다.'}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex justify-between items-center text-xs text-gray-400 font-medium">
                        <span>{resultTab === 'card' ? `${prompt.length} / 5,000` : `글자수: ${generatedBlogPost.length}자`}</span>
                        {viralHooks.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-primary-600 font-bold">🔥 바이럴 훅 추천 완료</span>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-gray-100 flex flex-col">
                        <button 
                          onClick={() => setIsImageUploadOpen(!isImageUploadOpen)}
                          className="flex items-center justify-between w-full text-sm text-gray-600 hover:bg-gray-50 font-medium p-4 transition-colors"
                        >
                          <span className="flex items-center gap-2"><ImagePlus size={16} className="text-gray-400"/> 내 이미지 사용</span>
                          {isImageUploadOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </button>
                        
                        {isImageUploadOpen && (
                          <div className="p-4 bg-gray-50 border-t border-gray-100">
                            <div className="border-2 border-dashed border-gray-300 rounded-xl bg-white p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors relative">
                              <input 
                                type="file" 
                                multiple 
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                  if (e.target.files) {
                                    const newImages = Array.from(e.target.files).map(file => URL.createObjectURL(file));
                                    setUploadedImages([...uploadedImages, ...newImages]);
                                  }
                                }}
                              />
                              <div className="bg-gray-50 p-3 rounded-full mb-2">
                                <UploadCloud size={20} className="text-gray-400" />
                              </div>
                              <span className="text-sm font-bold text-gray-700">여기를 클릭하거나 이미지를 드래그하세요</span>
                              <span className="text-xs text-gray-400 mt-1">최대 10장 • PNG, JPG, WEBP 지원</span>
                            </div>
                            
                            {/* Uploaded Images Preview */}
                            {uploadedImages.length > 0 && (
                              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                                {uploadedImages.map((img, i) => (
                                  <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shrink-0 relative group">
                                    <img src={img} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setUploadedImages(uploadedImages.filter((_, index) => index !== i));
                                        }}
                                        className="text-white text-xs font-bold"
                                      >삭제</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 스타일 구성 (Style Configuration) */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[14px] font-bold text-gray-800">🎨 카드뉴스 스타일 구성</span>
                        <span className="text-[11px] text-gray-400 font-medium">(선택사항 - 미선택 시 템플릿 기본 적용)</span>
                      </div>
                      
                      {/* AI 추천 토글 버튼 */}
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                        <button
                          type="button"
                          onClick={() => {
                            const newValue = !useAiStyle;
                            setUseAiStyle(newValue);
                            if (newValue) {
                              setSelectedStyle(null);
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            useAiStyle
                              ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-bold ring-2 ring-indigo-100'
                              : 'border-gray-200 text-gray-500 hover:border-indigo-300'
                          }`}
                        >
                          <span>✨ AI가 골라주기</span>
                        </button>
                        {aiRecommendedStyle && (
                          <span className="text-[11px] text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-md font-medium">
                            추천: {BUILT_IN_THEMES.find(t => t.id === aiRecommendedStyle)?.label || ''}
                          </span>
                        )}
                      </div>

                      <div className={`grid grid-cols-4 sm:grid-cols-7 gap-2 transition-opacity duration-200 ${useAiStyle ? 'opacity-40' : 'opacity-100'}`}>
                        {BUILT_IN_THEMES.map(theme => {
                          const isSelected = selectedStyle === theme.id;
                          return (
                            <button
                              key={theme.id}
                              type="button"
                              onClick={() => {
                                setSelectedStyle(isSelected ? null : theme.id);
                                setUseAiStyle(false);
                              }}
                              className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-all text-center select-none cursor-pointer ${
                                isSelected
                                  ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold ring-2 ring-primary-100'
                                  : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50/50 text-gray-600'
                              }`}
                            >
                              <span className="text-xl mb-1">{theme.emoji}</span>
                              <span className="text-[11px] truncate w-full px-0.5">{theme.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Submit Button moved to left column bottom */}
                    <button 
                      onClick={() => {
                        // 텍스트 수정을 반영하기 위해 cardNewsData 동기화
                        try {
                          const rawData = localStorage.getItem('cardNewsData');
                          if (rawData) {
                            let data = JSON.parse(rawData);
                            const regex = /\[(\d+)장 [^\]]+\]\s*(.*?)(?=\n\s*\n\[|$)/gs;
                            const matches = [...prompt.matchAll(regex)];
                            
                            if (matches.length > 0) {
                              const updatedData = matches.map((match, i) => {
                                const pageNum = parseInt(match[1]);
                                const content = match[2].trim();
                                const lines = content.split('\n');
                                const title = lines[0] || "";
                                const body = lines.slice(1).join('\n') || "";
                                const existing = data.find((d: any) => d.page === pageNum) || data[i] || {};
                                return { ...existing, page: pageNum, title, body };
                              });
                              localStorage.setItem('cardNewsData', JSON.stringify(updatedData));
                            }
                          }
                        } catch (e) {}

                        localStorage.setItem('viralHooks', JSON.stringify(viralHooks));
                        localStorage.setItem('cardNewsDraft', prompt);
                        localStorage.setItem('selectedTemplate', JSON.stringify(selectedTemplate)); // 선택한 템플릿 정보 저장
                        if (selectedStyle) {
                          localStorage.setItem('cardnews_selected_style', selectedStyle);
                        } else if (useAiStyle) {
                          const validThemes = ['business', 'cafe', 'lifestyle', 'travel', 'fashion', 'food', 'education'];
                          if (aiRecommendedStyle && validThemes.includes(aiRecommendedStyle)) {
                            localStorage.setItem('cardnews_selected_style', aiRecommendedStyle);
                          } else {
                            localStorage.removeItem('cardnews_selected_style');
                          }
                        } else {
                          localStorage.removeItem('cardnews_selected_style');
                        }
                        localStorage.removeItem('editingDesign'); // 편집기로 넘어가기 전 이전 기록 확실히 삭제
                        window.location.href = '/cardnews/editor';
                      }}
                      className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-bold text-[15px] hover:bg-primary-700 transition-colors shadow-sm flex justify-center items-center gap-2 mt-2"
                    >
                      ✨ 장별 기획 생성
                    </button>
                  </div>

                  {/* Right: Settings */}
                  <div className="space-y-4">
                    {/* Language */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] font-bold text-gray-700">출력 언어</span>
                        <select className="text-[13px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-primary-400">
                          <option>입력에서 자동 감지</option>
                          <option>한국어</option>
                          <option>English</option>
                        </select>
                      </div>
                    </div>

                    {/* Generation Style */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                      <h3 className="text-[13px] font-bold text-gray-700 mb-3">생성 스타일</h3>
                      <div className="space-y-3">
                        <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${genStyle === 'free' ? 'border-primary-500 bg-primary-50/50' : 'border-gray-100 hover:bg-gray-50'}`} onClick={() => setGenStyle('free')}>
                          <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${genStyle === 'free' ? 'border-primary-600' : 'border-gray-300'}`}>
                            {genStyle === 'free' && <div className="w-2.5 h-2.5 rounded-full bg-primary-600" />}
                          </div>
                          <div>
                            <span className={`block text-sm font-bold mb-1 ${genStyle === 'free' ? 'text-primary-700' : 'text-gray-700'}`}>자유롭게 변형</span>
                            <span className="text-[11px] text-gray-500 leading-tight block">템플릿을 참고하되 AI가 내용에 맞게 자유롭게 꾸며줍니다. 더 다양한 결과물을 원할 때 추천합니다.</span>
                          </div>
                        </label>
                        <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${genStyle === 'origin' ? 'border-primary-500 bg-primary-50/50' : 'border-gray-100 hover:bg-gray-50'}`} onClick={() => setGenStyle('origin')}>
                          <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${genStyle === 'origin' ? 'border-primary-600' : 'border-gray-300'}`}>
                            {genStyle === 'origin' && <div className="w-2.5 h-2.5 rounded-full bg-primary-600" />}
                          </div>
                          <div>
                            <span className={`block text-sm font-bold mb-1 ${genStyle === 'origin' ? 'text-primary-700' : 'text-gray-700'}`}>원본 유지</span>
                            <span className="text-[11px] text-gray-500 leading-tight block">템플릿의 색상, 레이아웃을 최대한 그대로 사용합니다. 일관된 브랜드 이미지를 유지하고 싶을 때 추천합니다.</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Additional Instructions */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                      <h3 className="text-[13px] font-bold text-gray-700 mb-2 flex items-center gap-1">💡 추가 지시사항</h3>
                      <textarea 
                        className="w-full h-20 p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs resize-none focus:outline-none focus:border-primary-400 focus:bg-white placeholder:text-gray-400"
                        placeholder="AI에게 추가로 지시할 내용을 입력하세요...&#10;예: 전체적으로 밝은 톤으로 만들어주세요, 이모지를 사용하지 마세요"
                      />
                      <p className="text-[10px] text-gray-400 mt-2">AI가 카드뉴스를 생성할 때 참고할 추가 지시사항을 입력하세요</p>
                    </div>

                    {/* Pre-check Switch */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center justify-between">
                      <div>
                        <h3 className="text-[13px] font-bold text-gray-700 mb-0.5">만들기 전에 구성 확인하기</h3>
                        <p className="text-[10px] text-gray-400">켜두면 AI가 카드뉴스 구성을 먼저 보여줍니다.</p>
                      </div>
                      <button 
                        className={`w-10 h-6 rounded-full p-1 transition-colors relative shrink-0 ${checkBeforeGen ? 'bg-primary-600' : 'bg-gray-200'}`}
                        onClick={() => setCheckBeforeGen(!checkBeforeGen)}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checkBeforeGen ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* Slide Count Options */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-5 h-5 flex items-center justify-center bg-gray-100 rounded">
                          <span className="text-xs">📚</span>
                        </div>
                        <h3 className="text-[13px] font-bold text-gray-700">슬라이드 개수</h3>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${slideCountType === 'auto' ? 'border-primary-500 bg-primary-50/50' : 'border-gray-100 hover:bg-gray-50'}`} onClick={() => setSlideCountType('auto')}>
                          <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${slideCountType === 'auto' ? 'border-primary-600' : 'border-gray-300'}`}>
                            {slideCountType === 'auto' && <div className="w-2.5 h-2.5 rounded-full bg-primary-600" />}
                          </div>
                          <div>
                            <span className={`block text-[13px] font-bold mb-0.5 ${slideCountType === 'auto' ? 'text-primary-700' : 'text-gray-700'}`}>자동</span>
                            <span className="text-[10px] text-gray-500 leading-tight block">AI가 콘텐츠에 맞는 적절한 장수를 알아서 정합니다</span>
                          </div>
                        </label>

                        <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${slideCountType === 'manual' ? 'border-primary-500 bg-primary-50/50' : 'border-gray-100 hover:bg-gray-50'}`} onClick={() => setSlideCountType('manual')}>
                          <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${slideCountType === 'manual' ? 'border-primary-600' : 'border-gray-300'}`}>
                            {slideCountType === 'manual' && <div className="w-2.5 h-2.5 rounded-full bg-primary-600" />}
                          </div>
                          <div>
                            <span className={`block text-[13px] font-bold mb-0.5 ${slideCountType === 'manual' ? 'text-primary-700' : 'text-gray-700'}`}>직접 지정</span>
                            <span className="text-[10px] text-gray-500 leading-tight block">1~10장 사이에서 직접 결정합니다</span>
                          </div>
                        </label>
                      </div>
                      <p className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        콘텐츠 길이와 구성에 맞춰 AI가 적절한 장수를 결정합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Chat Button */}
      <div className="fixed bottom-8 right-8 w-14 h-14 bg-[#4A154B] rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform z-50">
        <MessageSquare className="text-white" size={24} />
      </div>

      {/* Instagram 예약 발행 모달 */}
      {showScheduleModal && schedulingDesign && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#E1306C"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                <div>
                  <h2 className="text-base font-bold text-gray-800">Instagram 예약 발행</h2>
                  {(schedulingDesign?.pages_data?.length ?? 0) > 1 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full mt-0.5">
                      <Images size={10} /> {schedulingDesign.pages_data.length}장 카로셀
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* 슬라이드 프리뷰 스트립 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-gray-700">🖼️ 슬라이드 미리보기</span>
                  {isCapturingSlides && (
                    <span className="flex items-center gap-1 text-[11px] text-orange-500 font-semibold">
                      <Loader2 size={11} className="animate-spin" /> 캡처 중...
                    </span>
                  )}
                  {!isCapturingSlides && capturedSlideUrls.length > 0 && (
                    <span className="text-[11px] text-green-600 font-semibold">✓ {capturedSlideUrls.length}장 캡처 완료</span>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {(schedulingDesign?.pages_data ?? []).map((_: any, i: number) => {
                    const url = capturedSlideUrls[i];
                    return (
                      <div key={i} className="relative shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200" style={{ width: 52, height: 65 }}>
                        {url ? (
                          <img src={url} alt={`슬라이드 ${i + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {isCapturingSlides ? <Loader2 size={14} className="animate-spin text-gray-400" /> : <span className="text-gray-300 text-xs font-bold">{i + 1}</span>}
                          </div>
                        )}
                        <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold text-white bg-black/50 rounded px-0.5">{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 캡션 생성 상태 */}
              {isGeneratingCaption && (
                <div className="flex items-center gap-3 p-4 bg-[#E1306C]/5 rounded-xl border border-[#E1306C]/20">
                  <Loader2 size={18} className="animate-spin text-[#E1306C] shrink-0" />
                  <p className="text-sm text-[#E1306C] font-medium">AI가 Instagram 캡션을 생성하고 있습니다...</p>
                </div>
              )}

              {/* 캡션 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700">📝 캡션</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGenerateCaption()}
                      disabled={isGeneratingCaption}
                      className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-primary-600 disabled:opacity-40"
                    >
                      <RefreshCcw size={11} /> 재생성
                    </button>
                    <button
                      onClick={() => copyToClipboard(scheduleCaption, 'caption')}
                      className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-primary-600"
                    >
                      {copiedCaption ? <><Check size={11} className="text-green-500" /> 복사됨</> : <><Copy size={11} /> 복사</>}
                    </button>
                  </div>
                </div>
                <textarea
                  value={scheduleCaption}
                  onChange={e => setScheduleCaption(e.target.value)}
                  rows={6}
                  placeholder={isGeneratingCaption ? 'AI 생성 중...' : '캡션을 입력하거나 AI 생성을 기다리세요'}
                  className="w-full p-3 text-sm bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-[#E1306C]/50 focus:bg-white transition-colors"
                />
              </div>

              {/* 해시태그 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700"># 해시태그</label>
                  <button
                    onClick={() => copyToClipboard(scheduleHashtags, 'hashtags')}
                    className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-primary-600"
                  >
                    {copiedHashtags ? <><Check size={11} className="text-green-500" /> 복사됨</> : <><Copy size={11} /> 복사</>}
                  </button>
                </div>
                <textarea
                  value={scheduleHashtags}
                  onChange={e => setScheduleHashtags(e.target.value)}
                  rows={3}
                  placeholder={isGeneratingCaption ? 'AI 생성 중...' : '#해시태그를 입력하세요'}
                  className="w-full p-3 text-sm bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-[#E1306C]/50 focus:bg-white transition-colors text-[#E1306C]"
                />
              </div>

              {/* 날짜/시간 */}
              <div>
                <label className="text-sm font-bold text-gray-700 mb-2 block">⏰ 예약 날짜 & 시간</label>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl focus-within:border-[#E1306C]/50 focus-within:bg-white transition-colors">
                    <Calendar size={14} className="text-gray-400 shrink-0" />
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1 bg-transparent text-sm text-gray-700 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-32 p-3 bg-gray-50 border border-gray-200 rounded-xl focus-within:border-[#E1306C]/50 focus-within:bg-white transition-colors">
                    <Clock size={14} className="text-gray-400 shrink-0" />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-gray-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 py-3 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSchedulePost}
                disabled={isScheduling || !scheduleCaption || !scheduleDate || isGeneratingCaption}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-gradient-to-r from-[#E1306C] to-[#833AB4] rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {isScheduling ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                예약 발행하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 다운로드 모달 */}
      {showDownloadModal && downloadingDesign && (
        <HistoryDownloadModal
          design={downloadingDesign}
          captureRefs={downloadRenderRefs}
          onClose={() => { setShowDownloadModal(false); setDownloadingDesign(null); }}
        />
      )}

      {/* Instagram 연동 설정 모달 */}
      {showIgSettingsModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#E1306C"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                <h2 className="text-base font-bold text-gray-800">Instagram 계정 연동</h2>
              </div>
              <button onClick={() => { setShowIgSettingsModal(false); setIgSaveError(''); }} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 leading-relaxed">
                <p className="font-bold mb-1">📋 연동 방법</p>
                <p>1. Meta for Developers에서 <strong>Instagram Graph API</strong> 앱을 만드세요</p>
                <p>2. <strong>Access Token</strong>과 <strong>Instagram User ID</strong>를 발급받으세요</p>
                <p>3. 아래에 입력하면 자동으로 유효성을 검증합니다</p>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 mb-2 block">Access Token</label>
                <input
                  type="password"
                  value={igAccessToken}
                  onChange={e => setIgAccessToken(e.target.value)}
                  placeholder="EAAxxxxxxxxxxxxxxxx..."
                  className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#E1306C]/50 focus:bg-white transition-colors font-mono"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 mb-2 block">Instagram User ID</label>
                <input
                  type="text"
                  value={igUserId}
                  onChange={e => setIgUserId(e.target.value)}
                  placeholder="17841400000000000"
                  className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#E1306C]/50 focus:bg-white transition-colors font-mono"
                />
              </div>

              {igSaveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{igSaveError}</div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => { setShowIgSettingsModal(false); setIgSaveError(''); }}
                className="flex-1 py-3 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveIgSettings}
                disabled={isSavingIg || !igAccessToken.trim() || !igUserId.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-gradient-to-r from-[#E1306C] to-[#833AB4] rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {isSavingIg ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {isSavingIg ? '검증 중...' : '연동하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summarizing Overlay */}
      {isSummarizing && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
            <h2 className="text-lg font-bold text-gray-800">템플릿에 맞게 내용을 최적화 중입니다...</h2>
            <p className="text-sm text-gray-500 mt-2">AI가 슬라이드 장수에 맞게 글을 다듬고 있습니다.</p>
          </div>
        </div>
      )}

      {/* Figma Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-[500px] shadow-2xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold mb-2">Figma 템플릿 가져오기</h2>
            <p className="text-sm text-gray-500 mb-6">Figma 파일 링크를 붙여넣어 템플릿으로 저장하세요.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Figma URL</label>
                <input 
                  type="text" 
                  value={figmaUrl}
                  onChange={(e) => setFigmaUrl(e.target.value)}
                  placeholder="https://www.figma.com/file/..." 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-primary-500"
                />
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center gap-3">
                <span className="text-xl">💡</span>
                <p className="text-xs text-gray-500 leading-relaxed">Figma에서 플러그인을 사용하여 `import.json`을 직접 업로드할 수도 있습니다. <br/><a href="#" className="text-primary-600 font-semibold underline">플러그인 가이드 보기</a></p>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3">
              <button 
                onClick={() => setShowTemplateModal(false)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  alert('Figma에서 디자인을 분석하여 템플릿으로 저장합니다. (API 연동 필요)');
                  setShowTemplateModal(false);
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700"
              >
                템플릿 저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── InsightBarChart ─────────────────────────────────────────────────────────
type ChartMetric = 'like_count' | 'comments_count' | 'reach' | 'eng_rate';

function InsightBarChart({ insights }: { insights: any[] }) {
  const [metric, setMetric] = useState<ChartMetric>('like_count');

  const getValue = (post: any): number => {
    if (metric === 'like_count') return post.like_count ?? 0;
    if (metric === 'comments_count') return post.comments_count ?? 0;
    if (metric === 'reach') return post.reach || post.impressions || 0;
    const reach = post.reach || post.impressions || 0;
    return reach > 0 ? ((post.like_count + post.comments_count) / reach) * 100 : 0;
  };

  const fmtVal = (v: number) =>
    metric === 'eng_rate' ? `${v.toFixed(1)}%` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));

  const sorted = [...insights]
    .map(p => ({ ...p, _val: getValue(p) }))
    .sort((a, b) => b._val - a._val);

  const maxVal = Math.max(...sorted.map(p => p._val), 1);

  const tabs: { key: ChartMetric; label: string; color: string; bar: string }[] = [
    { key: 'like_count',      label: '❤️ 좋아요', color: 'text-red-500',    bar: 'bg-gradient-to-r from-red-400 to-rose-500' },
    { key: 'comments_count',  label: '💬 댓글',   color: 'text-blue-500',   bar: 'bg-gradient-to-r from-blue-400 to-indigo-500' },
    { key: 'reach',           label: '👀 도달',   color: 'text-green-600',  bar: 'bg-gradient-to-r from-emerald-400 to-green-500' },
    { key: 'eng_rate',        label: '🎯 참여율', color: 'text-purple-600', bar: 'bg-gradient-to-r from-violet-400 to-purple-500' },
  ];

  const activeTab = tabs.find(t => t.key === metric)!;

  // 베스트 게시물
  const best = sorted[0];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-800">게시물별 성과 비교</h3>
        {best && (
          <span className="text-[11px] font-semibold text-yellow-600 bg-yellow-50 border border-yellow-100 px-2 py-0.5 rounded-full">
            🏆 베스트: {best.design_name?.slice(0, 12) ?? ''}
          </span>
        )}
      </div>

      {/* 메트릭 탭 */}
      <div className="flex gap-1.5 mb-5 bg-gray-50 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setMetric(t.key)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              metric === t.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 바 차트 */}
      <div className="space-y-3">
        {sorted.map((post, i) => {
          const pct = maxVal > 0 ? (post._val / maxVal) * 100 : 0;
          const dateStr = new Date(post.scheduled_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
          return (
            <div key={post.id} className="flex items-center gap-3">
              {/* 순위 */}
              <span className={`w-5 text-center text-xs font-black shrink-0 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-300'}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>

              {/* 썸네일 */}
              <div className="w-9 h-11 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                {post.thumbnail_url
                  ? <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">🖼</div>
                }
              </div>

              {/* 바 + 라벨 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-500 truncate max-w-[120px]">{post.design_name} <span className="text-gray-300">· {dateStr}</span></span>
                  <span className={`text-xs font-black ml-2 shrink-0 ${activeTab.color}`}>{fmtVal(post._val)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${activeTab.bar} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SVG 미니 라인차트 (최근 추이) */}
      {sorted.length >= 3 && (() => {
        // 날짜 순으로 정렬한 추이
        const chronological = [...insights]
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
          .map(p => getValue(p));
        const mx = Math.max(...chronological, 1);
        const W = 280; const H = 48; const PAD = 6;
        const pts = chronological.map((v, i) => {
          const x = PAD + (i / (chronological.length - 1)) * (W - PAD * 2);
          const y = PAD + (1 - v / mx) * (H - PAD * 2);
          return `${x},${y}`;
        }).join(' ');
        return (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 font-semibold mb-2">발행 순 추이</p>
            <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={metric === 'like_count' ? '#f87171' : metric === 'comments_count' ? '#60a5fa' : metric === 'reach' ? '#34d399' : '#a78bfa'} stopOpacity="0.3" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* 채우기 영역 */}
              <polygon
                points={`${PAD},${H - PAD} ${pts} ${W - PAD},${H - PAD}`}
                fill="url(#lineGrad)"
              />
              {/* 라인 */}
              <polyline
                points={pts}
                fill="none"
                stroke={metric === 'like_count' ? '#f87171' : metric === 'comments_count' ? '#60a5fa' : metric === 'reach' ? '#34d399' : '#a78bfa'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* 포인트 */}
              {chronological.map((v, i) => {
                const x = PAD + (i / (chronological.length - 1)) * (W - PAD * 2);
                const y = PAD + (1 - v / mx) * (H - PAD * 2);
                return <circle key={i} cx={x} cy={y} r="3" fill="white" stroke={metric === 'like_count' ? '#f87171' : metric === 'comments_count' ? '#60a5fa' : metric === 'reach' ? '#34d399' : '#a78bfa'} strokeWidth="2" />;
              })}
            </svg>
          </div>
        );
      })()}
    </div>
  );
}

// ─── HistoryDownloadModal ────────────────────────────────────────────────────
type DLRatio = '1:1' | '4:5' | '9:16';
type DLFormat = 'png' | 'zip' | 'pdf';

function HistoryDownloadModal({
  design,
  captureRefs,
  onClose,
}: {
  design: any;
  captureRefs: React.RefObject<Record<number, HTMLDivElement | null>>;
  onClose: () => void;
}) {
  const [ratio, setRatio] = useState<DLRatio>('4:5');
  const [format, setFormat] = useState<DLFormat>('zip');
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);
  const pagesData: any[] = design.pages_data ?? [];
  const SCALE = 1080 / 420;

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
    const canvas = await h2c(el, { scale: SCALE, useCORS: false, allowTaint: false, logging: false });
    imgs.forEach((img, i) => { img.src = origSrcs[i]; });
    return canvas;
  };

  const applyRatio = (src: HTMLCanvasElement, r: DLRatio): HTMLCanvasElement => {
    if (r === '4:5') return src;
    const sw = src.width;
    const sh = src.height;
    const tw = sw;
    const th = r === '1:1' ? sw : Math.round(sw * 16 / 9);
    const out = document.createElement('canvas');
    out.width = tw; out.height = th;
    const ctx = out.getContext('2d')!;
    if (r === '1:1') {
      const cropY = (sh - tw) / 2;
      ctx.drawImage(src, 0, cropY, tw, tw, 0, 0, tw, tw);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, tw, th);
      const padY = (th - sh) / 2;
      ctx.drawImage(src, 0, 0, sw, sh, 0, padY, sw, sh);
    }
    return out;
  };

  const captureAll = async (idxList: number[]): Promise<{ idx: number; dataUrl: string; name: string }[]> => {
    const results: { idx: number; dataUrl: string; name: string }[] = [];
    for (const idx of idxList) {
      const pg = pagesData[idx];
      if (!pg) continue;
      const el = captureRefs.current?.[idx];
      if (!el) continue;
      setProgress(`${idx + 1}/${idxList.length}장 캡처 중...`);
      const raw = await captureEl(el);
      const final = applyRatio(raw, ratio);
      const safeTitle = (pg.title ?? '').replace(/[\n/\\:*?"<>|]/g, '_').slice(0, 24) || `slide_${idx + 1}`;
      results.push({ idx, dataUrl: final.toDataURL('image/png'), name: safeTitle });
    }
    return results;
  };

  const triggerDownload = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const handleDownload = async () => {
    if (progress) return;
    // 폰트 로딩 대기
    await new Promise(r => setTimeout(r, 600));
    const suffix = ratio === '4:5' ? '' : `_${ratio.replace(':', 'x')}`;
    const designName = (design.name ?? '카드뉴스').replace(/[\n/\\:*?"<>|]/g, '_').slice(0, 30);
    try {
      if (format === 'png') {
        setProgress('캡처 중...');
        const [cap] = await captureAll([0]);
        if (cap) triggerDownload(cap.dataUrl, `${designName}_01${suffix}.png`);
        setDone(true);
        setTimeout(onClose, 800);
      } else if (format === 'zip') {
        setProgress('준비 중...');
        const [JSZip, { saveAs }] = await Promise.all([
          import('jszip').then(m => m.default),
          import('file-saver'),
        ]);
        const caps = await captureAll(pagesData.map((_, i) => i));
        const zip = new JSZip();
        setProgress('ZIP 압축 중...');
        for (const c of caps) {
          const blob = await fetch(c.dataUrl).then(r => r.blob());
          const num = String(c.idx + 1).padStart(2, '0');
          zip.file(`${num}_${c.name}${suffix}.png`, blob);
        }
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `${designName}_전체${suffix}.zip`);
        setDone(true);
        setTimeout(onClose, 800);
      } else {
        setProgress('PDF 생성 중...');
        const { jsPDF } = await import('jspdf');
        const [pw, ph] = ratio === '1:1' ? [170, 170] : ratio === '4:5' ? [170, 212.5] : [95.6, 170];
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pw, ph] });
        const caps = await captureAll(pagesData.map((_, i) => i));
        for (let i = 0; i < caps.length; i++) {
          if (i > 0) pdf.addPage([pw, ph]);
          pdf.addImage(caps[i].dataUrl, 'PNG', 0, 0, pw, ph);
          setProgress(`PDF ${i + 1}/${caps.length}장 추가 중...`);
        }
        pdf.save(`${designName}_전체${suffix}.pdf`);
        setDone(true);
        setTimeout(onClose, 800);
      }
    } catch (e: any) {
      setProgress('');
      alert('다운로드 실패: ' + friendlyError(e));
    }
  };

  const ratioOptions: { value: DLRatio; label: string; size: string; w: number; h: number }[] = [
    { value: '1:1', label: '1:1', size: '1080×1080', w: 10, h: 10 },
    { value: '4:5', label: '4:5', size: '1080×1350', w: 10, h: 12.5 },
    { value: '9:16', label: '9:16', size: '1080×1920', w: 10, h: 17.8 },
  ];

  const formatOptions: { value: DLFormat; label: string; icon: string; sub: string }[] = [
    { value: 'png', label: 'PNG', icon: '🖼️', sub: '1장 (표지)' },
    { value: 'zip', label: 'ZIP', icon: '📦', sub: `전체 ${pagesData.length}장` },
    { value: 'pdf', label: 'PDF', icon: '📄', sub: `전체 ${pagesData.length}장` },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] max-w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary-600" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">다운로드</h2>
              <p className="text-[11px] text-gray-400 truncate max-w-[240px]">{design.name} · {pagesData.length}장</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* 슬라이드 미리보기 스트립 */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2">슬라이드 목록</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {pagesData.map((pg: any, i: number) => (
                <div key={i} className="relative shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200" style={{ width: 44, height: 55 }}>
                  {pg.bgImage && <img src={pg.bgImage} alt="" className="w-full h-full object-cover" />}
                  <span className="absolute inset-0 flex items-end justify-center pb-0.5">
                    <span className="text-[9px] font-bold text-white bg-black/50 rounded px-0.5">{i + 1}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 비율 선택 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-3">출력 비율</p>
            <div className="flex gap-2.5">
              {ratioOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRatio(opt.value)}
                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all ${ratio === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-end justify-center" style={{ height: 30 }}>
                    <div
                      className={`rounded border-2 ${ratio === opt.value ? 'border-primary-500 bg-primary-100' : 'border-gray-300 bg-gray-100'}`}
                      style={{ width: `${opt.w * 1.7}px`, height: `${Math.min(opt.h * 1.7, 30)}px` }}
                    />
                  </div>
                  <span className={`text-xs font-bold ${ratio === opt.value ? 'text-primary-600' : 'text-gray-600'}`}>{opt.label}</span>
                  <span className={`text-[10px] ${ratio === opt.value ? 'text-primary-400' : 'text-gray-400'}`}>{opt.size}</span>
                </button>
              ))}
            </div>
            {ratio === '1:1' && <p className="text-[11px] text-amber-600 mt-2 bg-amber-50 px-3 py-1.5 rounded-lg">슬라이드 중앙을 기준으로 정방형 크롭됩니다.</p>}
            {ratio === '9:16' && <p className="text-[11px] text-blue-600 mt-2 bg-blue-50 px-3 py-1.5 rounded-lg">스토리 비율 — 상하에 검은색 여백이 추가됩니다.</p>}
          </div>

          {/* 형식 선택 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-3">형식</p>
            <div className="grid grid-cols-3 gap-2">
              {formatOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFormat(opt.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${format === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className={`text-xs font-bold ${format === opt.value ? 'text-primary-600' : 'text-gray-700'}`}>{opt.label}</span>
                  <span className={`text-[10px] ${format === opt.value ? 'text-primary-400' : 'text-gray-400'}`}>{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 다운로드 버튼 */}
          {progress ? (
            <div className="w-full py-3.5 bg-primary-50 border border-primary-100 rounded-xl flex items-center justify-center gap-2">
              <svg className="animate-spin text-primary-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25"/><path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/></svg>
              <span className="text-sm text-primary-700 font-semibold">{progress}</span>
            </div>
          ) : done ? (
            <div className="w-full py-3.5 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-600" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span className="text-sm text-green-700 font-bold">다운로드 완료!</span>
            </div>
          ) : (
            <button
              onClick={handleDownload}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              다운로드 시작
            </button>
          )}

          <p className="text-center text-[10px] text-gray-400">1080px 고해상도 · 텍스트 포함 렌더링</p>
        </div>
      </div>
    </div>
  );
}
