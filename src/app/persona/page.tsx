'use client';
import { useState, useEffect } from 'react';
import { Sparkles, Save, CheckCircle2, User, Target, Palette, Hash, Megaphone, ChevronRight, RotateCcw, Loader2, Plus, Pencil, Trash2, ArrowLeft, ChevronLeft } from 'lucide-react';

const TONE_OPTIONS = [
  { value: 'friendly', label: '친근한', desc: '따뜻하고 편안한 말투', emoji: '😊', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  { value: 'professional', label: '전문적인', desc: '신뢰감 있고 정확한 말투', emoji: '💼', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { value: 'trendy', label: '트렌디한', desc: 'Z세대 감성, 최신 유행어', emoji: '🔥', color: 'bg-pink-50 border-pink-200 text-pink-700' },
  { value: 'emotional', label: '감성적인', desc: '공감과 감동을 주는 말투', emoji: '✨', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { value: 'humorous', label: '유머러스한', desc: '재치있고 웃음 주는 말투', emoji: '😄', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  { value: 'authoritative', label: '권위있는', desc: '전문가·리더 이미지', emoji: '🏆', color: 'bg-gray-50 border-gray-300 text-gray-700' },
];

const EMOJI_STYLE_OPTIONS = [
  { value: 'lots', label: '많이 사용', desc: '이모지 풍부하게', emoji: '🎉🎊✨💫' },
  { value: 'moderate', label: '적당히', desc: '포인트로만 사용', emoji: '✅ 핵심만' },
  { value: 'none', label: '사용 안 함', desc: '텍스트 위주', emoji: '텍스트만' },
];

const INDUSTRY_OPTIONS = ['뷰티/패션', '음식/요리', '피트니스/건강', '여행/라이프스타일', '교육/자기계발', '비즈니스/마케팅', 'IT/테크', '부동산/금융', '육아/가족', '예술/디자인', '기타'];

const GOAL_OPTIONS = [
  { value: 'brand_awareness', label: '브랜드 인지도', desc: '팔로워 늘리기', icon: '📣' },
  { value: 'sales', label: '판매/전환', desc: '제품·서비스 판매', icon: '💰' },
  { value: 'community', label: '커뮤니티 형성', desc: '팬 베이스 구축', icon: '🤝' },
  { value: 'education', label: '정보 전달', desc: '유용한 콘텐츠 제공', icon: '📚' },
  { value: 'engagement', label: '인게이지먼트', desc: '좋아요·댓글·저장 극대화', icon: '❤️' },
];

interface Persona {
  id?: string;
  persona_name?: string;
  brand_name: string;
  tone: string;
  target_audience: string;
  keywords: string[];
  industry: string;
  posting_goal: string;
  brand_color: string;
  emoji_style: string;
}

const DEFAULT_PERSONA: Persona = {
  persona_name: '',
  brand_name: '',
  tone: 'friendly',
  target_audience: '',
  keywords: [],
  industry: '',
  posting_goal: 'brand_awareness',
  brand_color: '#6366F1',
  emoji_style: 'moderate',
};

export default function PersonaPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [persona, setPersona] = useState<Persona>(DEFAULT_PERSONA);
  const [isEditing, setIsEditing] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(0);

  const loadPersonas = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/brand-persona');
      const data = await res.json();
      if (data.personas) {
        setPersonas(data.personas);
      }
    } catch (e) {
      console.error('페르소나 리스트 로드 실패:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPersonas();
  }, []);

  const addKeyword = () => {
    const kw = keywordInput.trim().replace(/^#/, '');
    if (kw && !persona.keywords.includes(kw) && persona.keywords.length < 15) {
      setPersona(p => ({ ...p, keywords: [...p.keywords, kw] }));
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw: string) => setPersona(p => ({ ...p, keywords: p.keywords.filter(k => k !== kw) }));

  const handleSave = async () => {
    if (!persona.brand_name.trim()) { alert('브랜드 이름을 입력해주세요'); return; }
    
    // 식별 이름이 없으면 브랜드 이름을 기본 식별명으로 대입
    const finalPersonaName = persona.persona_name?.trim() || persona.brand_name.trim();
    const payload = { ...persona, persona_name: finalPersonaName };

    setIsSaving(true);
    try {
      const res = await fetch('/api/brand-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      
      await loadPersonas();
      setIsEditing(false);
    } catch (e: any) {
      alert('저장 실패: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`'${name}' 페르소나를 정말 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/brand-persona?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json()).error);
      
      await loadPersonas();
    } catch (e: any) {
      alert('삭제 실패: ' + e.message);
    }
  };

  const startNewPersona = () => {
    setPersona(DEFAULT_PERSONA);
    setActiveSection(0);
    setIsEditing(true);
  };

  const startEditPersona = (p: Persona) => {
    setPersona({
      ...DEFAULT_PERSONA,
      ...p,
      persona_name: p.persona_name || p.brand_name,
      keywords: p.keywords || []
    });
    setActiveSection(0);
    setIsEditing(true);
  };

  const completeness = [
    !!persona.brand_name,
    !!persona.tone,
    !!persona.target_audience,
    persona.keywords.length > 0,
    !!persona.industry,
    !!persona.posting_goal,
  ].filter(Boolean).length;

  const sections = [
    { icon: <User size={16} />, label: '브랜드 기본 정보' },
    { icon: <Target size={16} />, label: '타겟 & 업종' },
    { icon: <Hash size={16} />, label: '핵심 키워드' },
    { icon: <Megaphone size={16} />, label: '톤앤매너' },
    { icon: <Palette size={16} />, label: '스타일 설정' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  // ─── 1. 목록 화면 (isEditing === false) ───────────────────────────────────
  if (!isEditing) {
    return (
      <div className="flex flex-col h-full bg-gray-50 overflow-y-auto p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-gray-900 flex items-center gap-2">
                <Sparkles size={24} className="text-primary-500" /> 브랜드 페르소나 보관함
              </h1>
              <p className="text-xs md:text-sm text-gray-500 mt-1">여러 개의 페르소나 스타일을 저장해 두고, 콘텐츠 생성 시 골라서 사용할 수 있습니다.</p>
            </div>
            <button
              onClick={startNewPersona}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all hover:scale-[1.02] shrink-0"
            >
              <Plus size={16} /> 새 페르소나 추가
            </button>
          </div>

          {/* Persona Card Grid */}
          {personas.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center max-w-xl mx-auto mt-8 space-y-4">
              <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center text-primary-500 mx-auto">
                <Plus size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-base">보관된 페르소나가 없습니다</h3>
                <p className="text-xs text-gray-400 mt-1">인스타그램 계정의 정체성과 글쓰기 톤을 맞춘 첫 페르소나를 등록해 보세요.</p>
              </div>
              <button
                onClick={startNewPersona}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-sm transition-all"
              >
                페르소나 만들기
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {personas.map((p) => {
                const toneLabel = TONE_OPTIONS.find(t => t.value === p.tone)?.label || p.tone;
                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-gray-200 hover:border-primary-200 hover:shadow-md transition-all p-5 flex flex-col justify-between relative group overflow-hidden"
                  >
                    {/* Brand color accents */}
                    <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: p.brand_color || '#6366F1' }} />
                    
                    <div className="space-y-4">
                      {/* Avatar & Header */}
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-base font-black shadow-sm"
                          style={{ backgroundColor: p.brand_color || '#6366F1' }}
                        >
                          {p.persona_name?.[0]?.toUpperCase() || 'B'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-gray-800 text-sm truncate">{p.persona_name || '기본 페르소나'}</h3>
                          <p className="text-xs text-gray-400 truncate">@{p.brand_name}</p>
                        </div>
                      </div>

                      {/* Content summary */}
                      <div className="space-y-2.5 text-xs text-gray-600 bg-gray-50 rounded-xl p-3">
                        <p className="line-clamp-2"><span className="font-bold text-gray-700">🎯 타겟:</span> {p.target_audience}</p>
                        <p><span className="font-bold text-gray-700">🏷️ 업종/톤:</span> {p.industry} · {toneLabel} 말투</p>
                        {p.keywords && p.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.keywords.slice(0, 4).map((k) => (
                              <span key={k} className="px-1.5 py-0.5 bg-white text-primary-600 border border-primary-100 rounded text-[10px] font-medium">#{k}</span>
                            ))}
                            {p.keywords.length > 4 && <span className="text-[10px] text-gray-400 self-center">+{p.keywords.length - 4}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
                      <button
                        onClick={() => startEditPersona(p)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg font-medium transition-all"
                      >
                        <Pencil size={12} /> 편집
                      </button>
                      <button
                        onClick={() => p.id && handleDelete(p.id, p.persona_name || p.brand_name)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium transition-all"
                      >
                        <Trash2 size={12} /> 삭제
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 2. 편집 화면 (isEditing === true) ───────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-5 flex items-center justify-between shrink-0">
        <div className="ml-10 md:ml-0 flex items-center gap-3">
          <button
            onClick={() => setIsEditing(false)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2">
              <Sparkles size={20} className="text-primary-500" /> 
              {persona.id ? '페르소나 편집하기' : '새 페르소나 만들기'}
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">상세 프로필을 바탕으로 AI가 최적의 문장과 이미지를 설계합니다.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-gray-500 mb-1">완성도</div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${(completeness / 6) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-primary-600">{completeness}/6</span>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${saved ? 'bg-green-500 text-white' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
            {saved ? '저장 완료!' : '저장하기'}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-auto md:overflow-hidden">
        {/* Left nav */}
        <div className="w-full md:w-52 bg-white border-b md:border-b-0 md:border-r border-gray-100 py-2 md:py-4 shrink-0 flex md:flex-col flex-row overflow-x-auto md:overflow-x-visible gap-0">
          {sections.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveSection(i)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors ${activeSection === i ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Section 0: 브랜드 기본 정보 */}
            {activeSection === 0 && (
              <div className="space-y-6">
                <SectionTitle icon={<User size={18} />} title="브랜드 기본 정보" />
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">페르소나 식별 이름 *</label>
                    <input
                      type="text"
                      value={persona.persona_name || ''}
                      onChange={e => setPersona(p => ({ ...p, persona_name: e.target.value }))}
                      placeholder="예: 부동산 소식 전달형, 맛집 투어 브랜딩 (구분용)"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">인스타그램 계정명 *</label>
                    <input
                      type="text"
                      value={persona.brand_name}
                      onChange={e => setPersona(p => ({ ...p, brand_name: e.target.value }))}
                      placeholder="예: @aptshowhome, @mukstagram_daily"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">카드뉴스 마무리 페이지와 워터마크에 해당 계정명이 자동으로 삽입됩니다.</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">브랜드 색상</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={persona.brand_color}
                        onChange={e => setPersona(p => ({ ...p, brand_color: e.target.value }))}
                        className="w-12 h-12 rounded-lg border border-gray-200 cursor-pointer"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-700">{persona.brand_color}</p>
                        <p className="text-xs text-gray-400">생성되는 카드뉴스의 강조 컬러 및 포인트 라벨에 적용됩니다.</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6'].map(c => (
                        <button key={c} onClick={() => setPersona(p => ({ ...p, brand_color: c }))}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${persona.brand_color === c ? 'border-gray-800 scale-110' : 'border-white shadow'}`}
                          style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 px-4 py-2 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-100">
                    목록으로
                  </button>
                  <button onClick={() => setActiveSection(1)} className="flex items-center gap-1.5 px-4 py-2 bg-primary-50 text-primary-700 rounded-xl text-sm font-bold hover:bg-primary-100">
                    다음 <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Section 1: 타겟 & 업종 */}
            {activeSection === 1 && (
              <div className="space-y-6">
                <SectionTitle icon={<Target size={18} />} title="타겟 & 업종" />
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">타겟 고객층 *</label>
                    <textarea
                      value={persona.target_audience}
                      onChange={e => setPersona(p => ({ ...p, target_audience: e.target.value }))}
                      placeholder="예: 20-30대 직장인 여성, 다이어트에 관심 많고 건강한 라이프스타일을 추구하는 사람들"
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">구체적일수록 AI가 더 정확한 콘텐츠를 생성합니다.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">업종/카테고리 *</label>
                    <div className="flex flex-wrap gap-2">
                      {INDUSTRY_OPTIONS.map(ind => (
                        <button
                          key={ind}
                          onClick={() => setPersona(p => ({ ...p, industry: ind }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${persona.industry === ind ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
                        >{ind}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">SNS 운영 목표 *</label>
                    <div className="grid grid-cols-1 gap-2">
                      {GOAL_OPTIONS.map(g => (
                        <button
                          key={g.value}
                          onClick={() => setPersona(p => ({ ...p, posting_goal: g.value }))}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${persona.posting_goal === g.value ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          <span className="text-xl">{g.icon}</span>
                          <div>
                            <p className={`text-sm font-bold ${persona.posting_goal === g.value ? 'text-primary-700' : 'text-gray-700'}`}>{g.label}</p>
                            <p className="text-xs text-gray-400">{g.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setActiveSection(0)} className="flex items-center gap-1.5 px-4 py-2 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-100">
                    이전
                  </button>
                  <button onClick={() => setActiveSection(2)} className="flex items-center gap-1.5 px-4 py-2 bg-primary-50 text-primary-700 rounded-xl text-sm font-bold hover:bg-primary-100">
                    다음 <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Section 2: 핵심 키워드 */}
            {activeSection === 2 && (
              <div className="space-y-6">
                <SectionTitle icon={<Hash size={18} />} title="핵심 키워드" />
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">브랜드 핵심 키워드 (최대 15개)</label>
                    <p className="text-xs text-gray-400 mb-3">해시태그, 자주 쓰는 단어, 브랜드 슬로건 등</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={keywordInput}
                        onChange={e => setKeywordInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                        placeholder="#키워드 입력 후 Enter"
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none"
                      />
                      <button onClick={addKeyword} className="px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-bold hover:bg-primary-600">추가</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[60px]">
                    {persona.keywords.length === 0 && (
                      <p className="text-sm text-gray-300 py-4">아직 키워드가 없습니다. 위에서 추가해주세요.</p>
                    )}
                    {persona.keywords.map(kw => (
                      <span key={kw} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm font-medium border border-primary-200">
                        #{kw}
                        <button onClick={() => removeKeyword(kw)} className="text-primary-400 hover:text-primary-700 ml-1">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-500 mb-2">추천 키워드 (클릭하여 추가)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {getSuggestedKeywords(persona.industry).map(kw => (
                        !persona.keywords.includes(kw) && (
                          <button key={kw} onClick={() => setPersona(p => ({ ...p, keywords: p.keywords.length < 15 ? [...p.keywords, kw] : p.keywords }))}
                            className="px-2.5 py-1 bg-gray-50 text-gray-500 border border-gray-200 rounded-full text-xs hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50">
                            +{kw}
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setActiveSection(1)} className="flex items-center gap-1.5 px-4 py-2 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-100">이전</button>
                  <button onClick={() => setActiveSection(3)} className="flex items-center gap-1.5 px-4 py-2 bg-primary-50 text-primary-700 rounded-xl text-sm font-bold hover:bg-primary-100">다음 <ChevronRight size={14} /></button>
                </div>
              </div>
            )}

            {/* Section 3: 톤앤매너 */}
            {activeSection === 3 && (
              <div className="space-y-6">
                <SectionTitle icon={<Megaphone size={18} />} title="톤앤매너" />
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <label className="block text-sm font-bold text-gray-700 mb-3">글쓰기 톤 선택 *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {TONE_OPTIONS.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setPersona(p => ({ ...p, tone: t.value }))}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${persona.tone === t.value ? `${t.color} border-2` : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                      >
                        <span className="text-2xl">{t.emoji}</span>
                        <div>
                          <p className="text-sm font-bold">{t.label}</p>
                          <p className="text-xs opacity-70 mt-0.5">{t.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setActiveSection(2)} className="flex items-center gap-1.5 px-4 py-2 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-100">이전</button>
                  <button onClick={() => setActiveSection(4)} className="flex items-center gap-1.5 px-4 py-2 bg-primary-50 text-primary-700 rounded-xl text-sm font-bold hover:bg-primary-100">다음 <ChevronRight size={14} /></button>
                </div>
              </div>
            )}

            {/* Section 4: 스타일 설정 */}
            {activeSection === 4 && (
              <div className="space-y-6">
                <SectionTitle icon={<Palette size={18} />} title="스타일 설정" />
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                  <label className="block text-sm font-bold text-gray-700 mb-3">이모지 사용 스타일</label>
                  <div className="space-y-2">
                    {EMOJI_STYLE_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => setPersona(p => ({ ...p, emoji_style: o.value }))}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${persona.emoji_style === o.value ? 'border-primary-400 bg-primary-50' : 'border-gray-100 hover:border-gray-200'}`}
                      >
                        <div className="text-left">
                          <p className={`text-sm font-bold ${persona.emoji_style === o.value ? 'text-primary-700' : 'text-gray-700'}`}>{o.label}</p>
                          <p className="text-xs text-gray-400">{o.desc}</p>
                        </div>
                        <span className="text-sm">{o.emoji}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <p className="text-sm font-bold text-gray-700 mb-3">페르소나 요약</p>
                  <div className="bg-gradient-to-br from-primary-50 to-purple-50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black" style={{ background: persona.brand_color }}>
                        {persona.persona_name?.[0]?.toUpperCase() || 'B'}
                      </div>
                      <span className="font-bold text-gray-800">{persona.persona_name || persona.brand_name || '브랜드명 미입력'}</span>
                    </div>
                    <p className="text-xs text-gray-600">🎯 타겟: {persona.target_audience || '미입력'}</p>
                    <p className="text-xs text-gray-600">🏷️ 업종: {persona.industry || '미입력'} · {TONE_OPTIONS.find(t => t.value === persona.tone)?.label || ''} 톤</p>
                    <p className="text-xs text-gray-600">🔑 키워드: {persona.keywords.length > 0 ? persona.keywords.slice(0, 5).map(k => '#' + k).join(' ') : '없음'}</p>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button onClick={() => setActiveSection(3)} className="flex items-center gap-1.5 px-4 py-2 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-100">이전</button>
                  <button onClick={handleSave} disabled={isSaving}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${saved ? 'bg-green-500 text-white' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}>
                    {isSaving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                    {saved ? '저장 완료!' : '페르소나 저장'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600">{icon}</div>
      <h2 className="text-base font-black text-gray-800">{title}</h2>
    </div>
  );
}

function getSuggestedKeywords(industry: string): string[] {
  const map: Record<string, string[]> = {
    '뷰티/패션': ['데일리룩', 'OOTD', '뷰티팁', '스킨케어', '메이크업', '코디추천'],
    '음식/요리': ['맛집추천', '집밥', '레시피', '먹스타그램', '요리일상', '오늘뭐먹지'],
    '피트니스/건강': ['운동루틴', '다이어트', '헬스', '홈트', '건강식', '바디프로필'],
    '여행/라이프스타일': ['여행스타그램', '국내여행', '일상', '카페투어', '주말나들이'],
    '교육/자기계발': ['공부법', '자기계발', '독서', '습관', '목표설정', '성장'],
    '비즈니스/마케팅': ['마케팅팁', '브랜딩', '창업', '스타트업', '비즈니스'],
    'IT/테크': ['개발자', '테크뉴스', '앱추천', 'AI', '디지털노마드'],
    '부동산/금융': ['재테크', '부동산', '투자', '경제공부', '절약'],
    '육아/가족': ['육아일기', '아기', '엄마', '육아꿀팁', '가족'],
    '예술/디자인': ['디자인', '일러스트', '그림', '아트', '크리에이터'],
  };
  return map[industry] || ['콘텐츠', 'SNS마케팅', '인스타그램', '팔로우', '소통'];
}
