'use client';
import { useState, useEffect } from 'react';
import { MessageSquare, Sparkles, Plus, Trash2, Copy, CheckCheck, Loader2, Search, Edit3, X, Save, Bot, ChevronDown, ChevronUp } from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: '전체', emoji: '📋' },
  { id: 'general', label: '일반 감사', emoji: '🙏' },
  { id: 'sales', label: '세일즈 전환', emoji: '💰' },
  { id: 'dm_invite', label: 'DM 유도', emoji: '📩' },
  { id: 'negative', label: '부정 댓글', emoji: '🛡️' },
  { id: 'question', label: '질문 답변', emoji: '❓' },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-green-100 text-green-700 border-green-200',
  sales: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  dm_invite: 'bg-blue-100 text-blue-700 border-blue-200',
  negative: 'bg-red-100 text-red-700 border-red-200',
  question: 'bg-purple-100 text-purple-700 border-purple-200',
};

interface Template {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
}

const AI_TONE_OPTIONS = [
  { value: 'friendly', label: '친근·다정' },
  { value: 'professional', label: '전문·신뢰' },
  { value: 'careful', label: '정중·신중' },
] as const;

interface AiReply {
  text: string;
  style: string;
}

export default function CommentsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [newTemplate, setNewTemplate] = useState({ category: 'general', title: '', content: '', tags: '' });

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiComment, setAiComment] = useState('');
  const [aiBrandName, setAiBrandName] = useState('');
  const [aiTone, setAiTone] = useState<(typeof AI_TONE_OPTIONS)[number]['value']>('friendly');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiReplies, setAiReplies] = useState<AiReply[]>([]);
  const [aiCopiedIdx, setAiCopiedIdx] = useState<number | null>(null);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/comment-templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleGenerate = async () => {
    if (!confirm('AI가 15개 댓글 템플릿을 자동 생성합니다. 기존 템플릿에 추가됩니다. 계속할까요?')) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/comment-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 생성된 템플릿들을 DB에 저장
      await Promise.all((data.templates || []).map((t: any) =>
        fetch('/api/comment-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(t),
        })
      ));
      await loadTemplates();
    } catch (e: any) {
      alert('생성 실패: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/comment-templates?id=${id}`, { method: 'DELETE' });
    setTemplates(t => t.filter(x => x.id !== id));
  };

  const handleAdd = async () => {
    if (!newTemplate.title.trim() || !newTemplate.content.trim()) return;
    const res = await fetch('/api/comment-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newTemplate, tags: newTemplate.tags.split(',').map(t => t.trim()).filter(Boolean) }),
    });
    const data = await res.json();
    if (data.template) {
      setTemplates(prev => [data.template, ...prev]);
      setShowAddModal(false);
      setNewTemplate({ category: 'general', title: '', content: '', tags: '' });
    }
  };

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAiReply = async () => {
    if (!aiComment.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiReplies([]);
    try {
      const res = await fetch('/api/comments/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: aiComment, tone: aiTone, brandName: aiBrandName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      setAiReplies(data.replies ?? []);
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const aiCopy = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setAiCopiedIdx(idx);
    setTimeout(() => setAiCopiedIdx(null), 2000);
  };

  const filtered = templates.filter(t => {
    const matchCat = activeCategory === 'all' || t.category === activeCategory;
    const matchSearch = !searchQuery || t.title.includes(searchQuery) || t.content.includes(searchQuery);
    return matchCat && matchSearch;
  });

  const countByCategory = (cat: string) => cat === 'all' ? templates.length : templates.filter(t => t.category === cat).length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-5 shrink-0 flex items-center justify-between">
        <div className="ml-10 md:ml-0">
          <h1 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2">
            <MessageSquare size={20} className="text-primary-500" /> 댓글 템플릿 관리
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">자주 사용하는 댓글 답변을 저장하고 빠르게 복사하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiPanel(v => !v)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            <Bot size={14} /> AI 답변하기
            {showAiPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            <Plus size={14} /> 직접 추가
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 text-white rounded-xl text-sm font-bold"
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isGenerating ? '생성 중...' : 'AI 자동 생성'}
          </button>
        </div>
      </div>

      {/* AI 답변하기 패널 */}
      {showAiPanel && (
        <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-5 shrink-0">
          <div className="max-w-3xl">
            <p className="text-sm font-bold text-gray-700 mb-3">실제 댓글에 맞는 답변을 AI가 3가지 버전으로 생성해드려요</p>
            <div className="space-y-3">
              <textarea
                value={aiComment}
                onChange={e => setAiComment(e.target.value)}
                placeholder="댓글 원문을 붙여넣어 주세요. 예: 분양가가 어느 정도인가요?"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={aiBrandName}
                  onChange={e => setAiBrandName(e.target.value)}
                  placeholder="브랜드/계정명 (선택, 예: @aptshowhome)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                />
                <div className="flex gap-2">
                  {AI_TONE_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setAiTone(o.value)}
                      className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                        aiTone === o.value
                          ? 'bg-primary-50 border-primary-400 text-primary-700'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {aiError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <span className="text-red-500 text-xs">{aiError}</span>
                </div>
              )}

              <button
                onClick={handleAiReply}
                disabled={aiLoading || !aiComment.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 text-white rounded-xl text-sm font-bold"
              >
                {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                {aiLoading ? '답변 생성 중...' : 'AI 답변 생성'}
              </button>
            </div>

            {aiReplies.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                {aiReplies.map((r, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex flex-col gap-2.5">
                    <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-full w-fit">{r.style}</span>
                    <p className="text-sm text-gray-700 leading-relaxed flex-1">{r.text}</p>
                    <button
                      onClick={() => aiCopy(idx, r.text)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${aiCopiedIdx === idx ? 'bg-green-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-primary-50 hover:text-primary-700'}`}
                    >
                      {aiCopiedIdx === idx ? <CheckCheck size={13} /> : <Copy size={13} />}
                      {aiCopiedIdx === idx ? '복사됨!' : '복사하기'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row flex-1 overflow-auto md:overflow-hidden">
        {/* Left: Categories */}
        <div className="w-full md:w-52 bg-white border-b md:border-b-0 md:border-r border-gray-100 py-3 md:py-4 shrink-0">
          <div className="px-3 mb-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="검색..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-300 outline-none"
              />
            </div>
          </div>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${activeCategory === cat.id ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <span className="flex items-center gap-2">{cat.emoji} {cat.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeCategory === cat.id ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                {countByCategory(cat.id)}
              </span>
            </button>
          ))}
        </div>

        {/* Right: Templates */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin text-primary-400" />
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare size={40} className="text-gray-200 mb-3" />
              <p className="font-bold text-gray-500">템플릿이 없습니다</p>
              <p className="text-sm mt-1">AI 자동 생성 또는 직접 추가해주세요</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(t => {
              const catColor = CATEGORY_COLORS[t.category] || 'bg-gray-100 text-gray-600 border-gray-200';
              const catInfo = CATEGORIES.find(c => c.id === t.category);
              const isEditing = editingId === t.id;
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${catColor}`}>
                      {catInfo?.emoji} {catInfo?.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingId(t.id); setEditContent(t.content); }} className="p-1.5 text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-100">
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gray-800">{t.title}</p>
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={4}
                        className="w-full text-sm text-gray-600 border border-primary-300 rounded-lg p-2 resize-none focus:ring-1 focus:ring-primary-300 outline-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50">취소</button>
                        <button
                          onClick={async () => {
                            setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, content: editContent } : x));
                            setEditingId(null);
                          }}
                          className="flex-1 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-bold hover:bg-primary-600 flex items-center justify-center gap-1"
                        >
                          <Save size={11} /> 저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 leading-relaxed flex-1">{t.content}</p>
                  )}
                  {t.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.tags.map(tag => <span key={tag} className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">#{tag}</span>)}
                    </div>
                  )}
                  <button
                    onClick={() => copy(t.id, t.content)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${copiedId === t.id ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-primary-50 hover:text-primary-700'}`}
                  >
                    {copiedId === t.id ? <CheckCheck size={13} /> : <Copy size={13} />}
                    {copiedId === t.id ? '복사됨!' : '복사하기'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-gray-900">템플릿 직접 추가</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">카테고리</label>
                <select value={newTemplate.category} onChange={e => setNewTemplate(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300">
                  {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">제목</label>
                <input type="text" value={newTemplate.title} onChange={e => setNewTemplate(p => ({ ...p, title: e.target.value }))}
                  placeholder="예: 기본 감사 인사" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">답변 내용</label>
                <textarea value={newTemplate.content} onChange={e => setNewTemplate(p => ({ ...p, content: e.target.value }))}
                  placeholder="감사합니다! 앞으로도 좋은 콘텐츠로 찾아뵐게요 😊" rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">태그 (쉼표 구분)</label>
                <input type="text" value={newTemplate.tags} onChange={e => setNewTemplate(p => ({ ...p, tags: e.target.value }))}
                  placeholder="감사, 인사, 긍정" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50">취소</button>
                <button onClick={handleAdd} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700">추가</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
