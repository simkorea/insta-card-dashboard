'use client';
import { useState, useEffect } from 'react';
import { Inbox, MessageSquare, Send, Loader2, RefreshCw, X, MessageCircle, Mail } from 'lucide-react';

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

export default function InstagramInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

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

  useEffect(() => { load(); }, []);

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

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-5 shrink-0 flex items-center justify-between">
        <div className="ml-10 md:ml-0">
          <h1 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2">
            <Inbox size={20} className="text-primary-500" /> 인스타그램 받은함
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">들어온 댓글·DM에 AI 초안을 확인하고 승인 후 전송하세요</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
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
                  <p className="text-xs text-gray-400 mb-3 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> AI 초안 생성 중이거나 실패했습니다</p>
                )}

                <textarea
                  value={currentText}
                  onChange={e => setDraftEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                  rows={3}
                  placeholder="전송할 답변을 직접 입력하거나 위 초안을 선택하세요"
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
