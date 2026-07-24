'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, Sparkles, Plus, Trash2, Copy, CheckCheck, Loader2, Search, Edit3, X, Save, Inbox } from 'lucide-react';

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

export default function CommentTemplatesPage() {
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
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">자주 사용하는 댓글 답변을 저장해두면 받은함에서 바로 골라 쓸 수 있어요</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* 받은함 / 템플릿 라이브러리 탭 */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 flex items-center gap-1 shrink-0">
        <Link href="/comments" className="flex items-center gap-1.5 px-4 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 border-b-2 border-transparent">
          <Inbox size={14} /> 받은함
        </Link>
        <span className="flex items-center gap-1.5 px-4 py-3 text-sm font-bold text-primary-700 border-b-2 border-primary-500">
          <MessageSquare size={14} /> 템플릿 라이브러리
        </span>
      </div>

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
