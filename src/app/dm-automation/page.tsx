'use client';
import { useState, useEffect } from 'react';
import { Zap, Plus, Loader2, Trash2, AlertTriangle, X, LayoutTemplate, ChevronDown, ChevronUp } from 'lucide-react';

interface Rule {
  id: string;
  keyword: string;
  dm_message: string;
  comment_reply: string | null;
  is_active: boolean;
  match_count: number;
  created_at: string;
}

interface Template {
  id: string;
  category: string;
  title: string;
  content: string;
}

export default function DmAutomationPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [dmMessage, setDmMessage] = useState('');
  const [commentReply, setCommentReply] = useState('DM 보내드렸어요! 확인해주세요 😊');
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmActivateId, setConfirmActivateId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dm-automation-rules');
      const data = await res.json();
      setRules(data.items || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetch('/api/comment-templates')
      .then(res => res.json())
      .then(data => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!keyword.trim() || !dmMessage.trim()) {
      setFormError('키워드와 DM 메시지는 필수예요');
      return;
    }
    setIsSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/dm-automation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, dmMessage, commentReply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      setKeyword('');
      setDmMessage('');
      setCommentReply('DM 보내드렸어요! 확인해주세요 😊');
      setShowForm(false);
      await load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (rule: Rule) => {
    // 켜는 경우(비활성 → 활성)에만 한 번 더 확인 — 이 순간부터 사람 검수 없이 바로 발송되기 때문
    if (!rule.is_active && confirmActivateId !== rule.id) {
      setConfirmActivateId(rule.id);
      return;
    }
    setConfirmActivateId(null);
    setTogglingId(rule.id);
    try {
      const res = await fetch(`/api/dm-automation-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.is_active }),
      });
      const data = await res.json();
      if (res.ok) setRules(prev => prev.map(r => (r.id === rule.id ? data.item : r)));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/dm-automation-rules/${id}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="mb-6 md:mb-8 pl-10 md:pl-0">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Zap size={20} className="text-amber-500" /> 키워드 자동 DM</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-1">댓글에 특정 키워드가 포함되면 사람 검수 없이 즉시 DM을 자동 발송합니다</p>
      </div>

      <div className="flex items-start gap-2.5 p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-6">
        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          다른 받은함(댓글/DM) 기능과 달리 이 규칙은 <b>켜두면 사람 확인 없이 즉시 전송</b>됩니다.
          문구는 미리 정한 템플릿이라 안전하지만, 켜기 전에 내용을 꼭 다시 확인해주세요.
          새로 만든 규칙은 항상 꺼진 상태로 시작합니다.
        </p>
      </div>

      <button
        onClick={() => setShowForm(v => !v)}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold mb-4"
      >
        {showForm ? <X size={14} /> : <Plus size={14} />}
        {showForm ? '취소' : '규칙 추가'}
      </button>

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">트리거 키워드</label>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="예: 가격, 정보, DM"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
            />
            <p className="text-[11px] text-gray-400 mt-1">댓글 내용에 이 단어가 포함되면(부분일치) 매칭돼요</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-700">자동 발송할 DM 메시지</label>
              <button
                type="button"
                onClick={() => setShowTemplates(v => !v)}
                className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-primary-700"
              >
                <LayoutTemplate size={11} /> 템플릿에서 가져오기
                {showTemplates ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            </div>
            {showTemplates && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2 max-h-40 overflow-y-auto bg-gray-50 rounded-xl p-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setDmMessage(t.content); setShowTemplates(false); }}
                    className="text-left p-2 rounded-lg bg-white border border-gray-200 text-[11px] hover:bg-primary-50 line-clamp-2"
                  >
                    {t.content}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={dmMessage}
              onChange={e => setDmMessage(e.target.value)}
              placeholder="DM으로 자동 발송될 내용을 입력하세요"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">댓글에 남길 공개 답글 <span className="text-gray-400 font-normal">(선택)</span></label>
            <input
              type="text"
              value={commentReply}
              onChange={e => setCommentReply(e.target.value)}
              placeholder="예: DM 보내드렸어요! 확인해주세요 😊"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
            />
          </div>

          {formError && <p className="text-red-500 text-xs">{formError}</p>}

          <button
            onClick={handleCreate}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-200 text-white rounded-xl text-sm font-bold"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {isSaving ? '저장 중...' : '규칙 저장 (꺼진 상태로 생성됨)'}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary-400" />
        </div>
      )}
      {!isLoading && rules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Zap size={36} className="text-gray-200 mb-3" />
          <p className="font-bold text-gray-500">등록된 규칙이 없습니다</p>
        </div>
      )}

      <div className="space-y-3">
        {rules.map(rule => (
          <div key={rule.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-bold bg-primary-50 text-primary-700 px-2 py-1 rounded-full">"{rule.keyword}"</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {rule.is_active ? '켜짐 · 자동 발송 중' : '꺼짐'}
                  </span>
                  <span className="text-[10px] text-gray-400">{rule.match_count}회 발송됨</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{rule.dm_message}</p>
                {rule.comment_reply && (
                  <p className="text-xs text-gray-400 mt-1">💬 공개 답글: {rule.comment_reply}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {confirmActivateId === rule.id ? (
              <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                <span className="text-[11px] text-amber-800 flex-1">정말 켤까요? 이제부터 확인 없이 자동으로 DM이 나갑니다.</span>
                <button onClick={() => handleToggle(rule)} className="text-xs font-bold bg-amber-500 text-white px-3 py-1.5 rounded-lg">켜기</button>
                <button onClick={() => setConfirmActivateId(null)} className="text-xs font-bold text-gray-500 px-2">취소</button>
              </div>
            ) : (
              <button
                onClick={() => handleToggle(rule)}
                disabled={togglingId === rule.id}
                className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ${rule.is_active ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-600 text-white hover:bg-green-700'}`}
              >
                {togglingId === rule.id ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                {rule.is_active ? '끄기' : '켜기'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
