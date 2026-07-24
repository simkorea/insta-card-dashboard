'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Inbox, MessageSquare, Send, Loader2, RefreshCw, X, MessageCircle, Mail, Bot, ChevronDown, ChevronUp, Copy, CheckCheck, LayoutTemplate } from 'lucide-react';

const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  general: { label: '일반 감사', emoji: '🙏' },
  sales: { label: '세일즈 전환', emoji: '💰' },
  dm_invite: { label: 'DM 유도', emoji: '📩' },
  negative: { label: '부정 댓글', emoji: '🛡️' },
  question: { label: '질문 답변', emoji: '❓' },
};

const AI_TONE_OPTIONS = [
  { value: 'friendly', label: '친근·다정' },
  { value: 'professional', label: '전문·신뢰' },
  { value: 'careful', label: '정중·신중' },
] as const;

interface AiDraft {
  text: string;
  style: string;
}

interface InboxItem {
  id: string;
  source: 'comment' | 'dm';
  ig_object_id: string;
  from_username: string | null;
  from_ig_id: string | null;
  text: string;
  status: string;
  ai_drafts: AiDraft[] | null;
  chosen_reply: string | null;
  created_at: string;
}

interface Template {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
}

export default function InstagramInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [openTemplatesFor, setOpenTemplatesFor] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiComment, setAiComment] = useState('');
  const [aiBrandName, setAiBrandName] = useState('');
  const [aiTone, setAiTone] = useState<(typeof AI_TONE_OPTIONS)[number]['value']>('friendly');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiReplies, setAiReplies] = useState<AiDraft[]>([]);
  const [aiCopiedIdx, setAiCopiedIdx] = useState<number | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/instagram/inbox');
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async () => {
    const res = await fetch('/api/comment-templates');
    const data = await res.json();
    setTemplates(data.templates || []);
  };

  useEffect(() => { load(); loadTemplates(); }, []);

  const handleSend = async (item: InboxItem) => {
    const message = (draftEdits[item.id] ?? item.chosen_reply ?? item.ai_drafts?.[0]?.text ?? '').trim();
    if (!message) return;
    setSendingId(item.id);
    setErrorById(prev => ({ ...prev, [item.id]: '' }));
    try {
      const endpoint = item.source === 'comment' ? '/api/instagram/comments/reply' : '/api/instagram/dm/send';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inboxId: item.id, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '전송 실패');
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e: any) {
      setErrorById(prev => ({ ...prev, [item.id]: e.message }));
    } finally {
      setSendingId(null);
    }
  };

  const handleIgnore = async (id: string) => {
    await fetch('/api/instagram/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'ignored' }),
    });
    setItems(prev => prev.filter(i => i.id !== id));
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

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-5 shrink-0 flex items-center justify-between">
        <div className="ml-10 md:ml-0">
          <h1 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2">
            <Inbox size={20} className="text-primary-500" /> 인스타그램 받은함
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">들어온 댓글·DM에 AI 초안이나 저장된 템플릿을 골라 수정 후 전송하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiPanel(v => !v)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            <Bot size={14} /> 직접 입력해서 답변 만들기
            {showAiPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={14} /> 새로고침
          </button>
        </div>
      </div>

      {/* 받은함 / 템플릿 라이브러리 탭 */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 flex items-center gap-1 shrink-0">
        <span className="flex items-center gap-1.5 px-4 py-3 text-sm font-bold text-primary-700 border-b-2 border-primary-500">
          <Inbox size={14} /> 받은함
        </span>
        <Link href="/comments/templates" className="flex items-center gap-1.5 px-4 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 border-b-2 border-transparent">
          <MessageSquare size={14} /> 템플릿 라이브러리
        </Link>
      </div>

      {/* 직접 입력해서 답변 만들기 패널 (아직 받은함에 안 들어온 댓글용) */}
      {showAiPanel && (
        <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-5 shrink-0">
          <div className="max-w-3xl">
            <p className="text-sm font-bold text-gray-700 mb-3">웹훅으로 안 들어온 댓글이라면 원문을 직접 붙여넣어 AI 답변을 받아보세요</p>
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

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-primary-400" />
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Inbox size={40} className="text-gray-200 mb-3" />
            <p className="font-bold text-gray-500">받은함이 비어있습니다</p>
            <p className="text-sm mt-1">새 댓글·DM이 들어오면 여기에 표시됩니다</p>
          </div>
        )}

        <div className="space-y-4 max-w-3xl mx-auto">
          {items.map(item => {
            const currentText = draftEdits[item.id] ?? item.chosen_reply ?? item.ai_drafts?.[0]?.text ?? '';
            const showTemplates = openTemplatesFor === item.id;
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border ${item.source === 'comment' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                      {item.source === 'comment' ? <MessageCircle size={12} /> : <Mail size={12} />}
                      {item.source === 'comment' ? '댓글' : 'DM'}
                    </span>
                    <span className="text-xs text-gray-400">{item.from_username ? `@${item.from_username}` : item.from_ig_id || '알 수 없음'}</span>
                  </div>
                  <button onClick={() => handleIgnore(item.id)} className="p-1.5 text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-100">
                    <X size={14} />
                  </button>
                </div>

                <p className="text-sm text-gray-800 bg-gray-50 rounded-xl p-3 mb-3">{item.text}</p>

                {item.ai_drafts?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    {item.ai_drafts.map((d, idx) => (
                      <button
                        key={idx}
                        onClick={() => setDraftEdits(prev => ({ ...prev, [item.id]: d.text }))}
                        className={`text-left p-3 rounded-xl border text-xs transition-colors ${currentText === d.text ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        <span className="font-bold text-primary-600 block mb-1">{d.style}</span>
                        <span className="text-gray-600 leading-relaxed">{d.text}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> AI 초안 생성 중이거나 실패했습니다</p>
                )}

                <button
                  onClick={() => setOpenTemplatesFor(showTemplates ? null : item.id)}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-primary-700 mb-2"
                >
                  <LayoutTemplate size={13} />
                  저장된 템플릿에서 선택
                  {showTemplates ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {showTemplates && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 max-h-56 overflow-y-auto bg-gray-50 rounded-xl p-2">
                    {templates.length === 0 && (
                      <p className="text-xs text-gray-400 p-2">저장된 템플릿이 없습니다</p>
                    )}
                    {templates.map(t => {
                      const cat = CATEGORIES[t.category];
                      return (
                        <button
                          key={t.id}
                          onClick={() => setDraftEdits(prev => ({ ...prev, [item.id]: t.content }))}
                          className={`text-left p-2.5 rounded-lg border text-xs bg-white transition-colors ${currentText === t.content ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          <span className="text-[10px] font-bold text-gray-400 block mb-0.5">{cat ? `${cat.emoji} ${cat.label}` : t.category} · {t.title}</span>
                          <span className="text-gray-600 leading-relaxed line-clamp-2">{t.content}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <textarea
                  value={currentText}
                  onChange={e => setDraftEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                  rows={3}
                  placeholder="전송할 답변을 직접 입력하거나 위 초안/템플릿을 선택하세요"
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 mb-2"
                />

                {errorById[item.id] && (
                  <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-xl mb-2">
                    <span className="text-red-500 text-xs">{errorById[item.id]}</span>
                  </div>
                )}

                <button
                  onClick={() => handleSend(item)}
                  disabled={sendingId === item.id || !currentText.trim()}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 text-white rounded-xl text-sm font-bold w-full"
                >
                  {sendingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sendingId === item.id ? '전송 중...' : '이 답변 전송'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
