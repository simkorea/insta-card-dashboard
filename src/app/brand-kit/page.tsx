'use client';
import { useState, useEffect, useRef } from 'react';
import { Palette, Type, Image as ImageIcon, Check, Loader2, Upload, X, RotateCcw } from 'lucide-react';
import Link from 'next/link';

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

interface BrandKit {
  brand_name: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  logo_url: string;
}

const DEFAULT_KIT: BrandKit = {
  brand_name: '',
  primary_color: '#6366f1',
  secondary_color: '#818cf8',
  font_family: 'Noto Sans KR',
  logo_url: '',
};

export default function BrandKitPage() {
  const [kit, setKit] = useState<BrandKit>(DEFAULT_KIT);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoPreview, setLogoPreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const gfLink = document.createElement('link');
    gfLink.rel = 'stylesheet';
    gfLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&family=Nanum+Gothic:wght@400;700;800&family=Nanum+Myeongjo:wght@400;700;800&family=Black+Han+Sans&family=Nanum+Pen+Script&family=Do+Hyeon&family=Jua&family=Gothic+A1:wght@400;700;900&display=swap';
    document.head.appendChild(gfLink);
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
      const dataUrl = reader.result as string;
      setLogoPreview(dataUrl);
      setKit(prev => ({ ...prev, logo_url: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: kit.brand_name,
          primary_color: kit.primary_color,
          secondary_color: kit.secondary_color,
          font_family: kit.font_family,
          logo_url: kit.logo_url,
        }),
      });
      // 로컬스토리지에도 저장 (에디터에서 즉시 사용)
      localStorage.setItem('brand_kit', JSON.stringify({
        logo: kit.logo_url,
        color: kit.primary_color,
        secondary_color: kit.secondary_color,
        font_family: kit.font_family,
        name: kit.brand_name,
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-gray-900">브랜드 키트</h1>
          <p className="text-xs text-gray-400 mt-0.5">로고·색상·폰트를 저장하면 모든 카드에 자동 적용됩니다</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? '저장됨' : '저장하기'}
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Preview */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">미리보기</p>
          <div
            className="rounded-xl p-6 flex flex-col items-center gap-3"
            style={{ background: `linear-gradient(135deg, ${kit.primary_color}22, ${kit.secondary_color}22)`, border: `2px solid ${kit.primary_color}30` }}
          >
            {logoPreview ? (
              <img src={logoPreview} alt="logo" className="h-12 object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl" style={{ background: kit.primary_color }}>
                {kit.brand_name ? kit.brand_name[0].toUpperCase() : 'B'}
              </div>
            )}
            <p className="font-bold text-lg" style={{ fontFamily: kit.font_family, color: kit.primary_color }}>
              {kit.brand_name || '브랜드 이름'}
            </p>
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ background: kit.primary_color }} title="주 색상" />
              <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ background: kit.secondary_color }} title="보조 색상" />
            </div>
            <p className="text-sm text-gray-500" style={{ fontFamily: kit.font_family }}>폰트: {kit.font_family}</p>
          </div>
        </div>

        {/* Brand Name */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <Type size={14} className="text-blue-600" />
            </div>
            <p className="text-sm font-bold text-gray-800">브랜드 이름</p>
          </div>
          <input
            type="text"
            value={kit.brand_name}
            onChange={e => setKit(prev => ({ ...prev, brand_name: e.target.value }))}
            placeholder="내 브랜드 이름을 입력하세요"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        {/* Logo */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
              <ImageIcon size={14} className="text-orange-500" />
            </div>
            <p className="text-sm font-bold text-gray-800">브랜드 로고</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          {logoPreview ? (
            <div className="flex items-center gap-4">
              <img src={logoPreview} alt="logo" className="h-16 object-contain border border-gray-200 rounded-xl p-2 bg-gray-50" />
              <div className="flex flex-col gap-2">
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  <Upload size={13} /> 교체
                </button>
                <button onClick={() => { setLogoPreview(''); setKit(prev => ({ ...prev, logo_url: '' })); }} className="flex items-center gap-1.5 px-3 py-2 border border-red-100 rounded-lg text-sm text-red-500 hover:bg-red-50">
                  <X size={13} /> 삭제
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
            >
              <Upload size={20} className="text-gray-300" />
              <p className="text-sm text-gray-400">클릭하여 로고 업로드</p>
              <p className="text-xs text-gray-300">PNG, SVG, JPG (권장: 투명 배경 PNG)</p>
            </button>
          )}
        </div>

        {/* Colors */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
              <Palette size={14} className="text-purple-600" />
            </div>
            <p className="text-sm font-bold text-gray-800">브랜드 색상</p>
          </div>

          {/* Color pickers */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">주 색상</p>
              <div className="flex items-center gap-2">
                <input type="color" value={kit.primary_color} onChange={e => setKit(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200 p-0.5" />
                <input type="text" value={kit.primary_color} onChange={e => setKit(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">보조 색상</p>
              <div className="flex items-center gap-2">
                <input type="color" value={kit.secondary_color} onChange={e => setKit(prev => ({ ...prev, secondary_color: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200 p-0.5" />
                <input type="text" value={kit.secondary_color} onChange={e => setKit(prev => ({ ...prev, secondary_color: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
            </div>
          </div>

          {/* Presets */}
          <p className="text-xs text-gray-500 mb-3 font-medium">색상 프리셋</p>
          <div className="grid grid-cols-4 gap-2">
            {COLOR_PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => setKit(prev => ({ ...prev, primary_color: preset.primary, secondary_color: preset.secondary }))}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-gray-100 hover:border-gray-300 transition-colors"
                title={preset.name}
              >
                <div className="flex gap-1">
                  <div className="w-5 h-5 rounded-full" style={{ background: preset.primary }} />
                  <div className="w-5 h-5 rounded-full" style={{ background: preset.secondary }} />
                </div>
                <span className="text-[9px] text-gray-500 text-center leading-tight">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
              <Type size={14} className="text-green-600" />
            </div>
            <p className="text-sm font-bold text-gray-800">브랜드 폰트</p>
          </div>
          <div className="space-y-2">
            {FONT_OPTIONS.map(font => (
              <button
                key={font.value}
                onClick={() => setKit(prev => ({ ...prev, font_family: font.value }))}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${kit.font_family === font.value ? 'border-primary-300 bg-primary-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
              >
                <span className="text-sm" style={{ fontFamily: font.value }}>{font.label}</span>
                <span className="text-base text-gray-400" style={{ fontFamily: font.value }}>가나다Aa</span>
              </button>
            ))}
          </div>
        </div>

        {/* Reset */}
        <div className="flex items-center justify-between pb-8">
          <button
            onClick={() => { setKit(DEFAULT_KIT); setLogoPreview(''); }}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600"
          >
            <RotateCcw size={13} /> 초기화
          </button>
          <Link href="/cardnews" className="text-sm text-primary-600 font-semibold hover:underline">
            카드뉴스 에디터로 이동 →
          </Link>
        </div>
      </div>
    </div>
  );
}
