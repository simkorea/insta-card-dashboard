'use client';
import { useState, useEffect } from 'react';
import { Bot, Copy, Check, Loader2, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const DM_TYPES = [
  { id: 'welcome',  label: '환영 DM',    emoji: '👋', desc: '새 팔로워에게 보내는 첫 인사' },
  { id: 'followup', label: '팔로업 DM',  emoji: '💬', desc: '댓글·좋아요에 감사하며 대화 이어가기' },
  { id: 'collab',   label: '협업 제안',  emoji: '🤝', desc: '협업·컨택 제안을 전문적으로' },
  { id: 'purchase', label: '구매 유도',  emoji: '🛒', desc: '부드럽게 가치를 전달하는 전환 DM' },
  { id: 'support',  label: '응원·감사',  emoji: '🙏', desc: '팔로워와의 관계를 더 깊게' },
];

const TONE_OPTIONS = [
  { value: 'friendly',     label: '친근하게' },
  { value: 'professional', label: '전문적으로' },
  { value: 'casual',       label: '편하게' },
  { value: 'warm',         label: '따뜻하게' },
];

interface DMVersion {
  style: string;
  content: string;
}

interface DMRecord {
  id: string;
  type: string;
  typeLabel: string;
  recipientName: string;
  versions: DMVersion[];
  createdAt: string;
}

export default function AutoDMPage() {
  const [selectedType, setSelectedType] = useState('welcome');
  const [recipientName, setRecipientName] = useState('');
  const [recipientInfo, setRecipientInfo] = useState('');
  const [tone, setTone] = useState('friendly');
  const [isGenerating, setIsGenerating] = useState(false);
  const [versions, setVersions] = useState<DMVersion[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<DMRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('auto_dm_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const saveHistory = (record: DMRecord) => {
    const updated = [record, ...history].slice(0, 20);
    setHistory(updated);
    localStorage.setItem('auto_dm_history', JSON.stringify(updated));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    setVersions([]);
    try {
      const res = await fetch('/api/generate/auto-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType, recipientName, recipientInfo, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      setVersions(data.versions ?? []);
      const typeInfo = DM_TYPES.find(t => t.id === selectedType);
      saveHistory({
        id: Date.now().toString(),
        type: selectedType,
        typeLabel: typeInfo?.label ?? selectedType,
        recipientName: recipientName || '미지정',
        versions: data.versions ?? [],
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleDeleteHistory = (id: string) => {
    const updated = history.filter(r => r.id !== id);
    setHistory(updated);
    localStorage.setItem('auto_dm_history', JSON.stringify(updated));
  };

  const currentType = DM_TYPES.find(t => t.id === selectedType);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-3 mb-2 pl-10 md:pl-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">자동 DM 생성기</h1>
            <p className="text-xs md:text-sm text-gray-500">AI가 상황에 맞는 인스타그램 DM 3가지 버전을 생성합니다</p>
          </div>
        </div>
      </div>

      {/* DM Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-gray-700 mb-3">DM 유형 선택</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {DM_TYPES.map(type => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                selectedType === type.id
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">{type.emoji}</span>
              <span className="text-[11px] font-bold leading-tight">{type.label}</span>
            </button>
          ))}
        </div>
        {currentType && (
          <p className="text-xs text-gray-400 mt-2 ml-1">{currentType.emoji} {currentType.desc}</p>
        )}
      </div>

      {/* Form */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              수신자 이름 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder="예: 지수님, @username"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">톤 선택</label>
            <select
              value={tone}
              onChange={e => setTone(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 transition-all bg-white"
            >
              {TONE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">
            수신자 특징 <span className="text-gray-400 font-normal">(선택 — 더 정확한 DM 생성)</span>
          </label>
          <textarea
            value={recipientInfo}
            onChange={e => setRecipientInfo(e.target.value)}
            placeholder="예: 인테리어 관심 많은 30대 여성, 댓글에서 가격 문의함, 소규모 카페 운영 중..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 transition-all"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
            <span className="text-red-500 text-xs">{error}</span>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-xl hover:from-violet-700 hover:to-purple-700 active:scale-[0.99] disabled:opacity-60 transition-all shadow-sm"
        >
          {isGenerating ? (
            <><Loader2 size={16} className="animate-spin" /> DM 생성 중...</>
          ) : (
            <><Bot size={16} /> DM 3가지 버전 생성</>
          )}
        </button>
      </div>

      {/* Results */}
      {versions.length > 0 && (
        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-800">생성된 DM</h2>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={13} /> 재생성
            </button>
          </div>
          {versions.map((v, idx) => (
            <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">{v.style}</span>
                <button
                  onClick={() => handleCopy(v.content, idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    copiedIdx === idx
                      ? 'bg-green-500 text-white'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {copiedIdx === idx ? <><Check size={12} /> 복사됨!</> : <><Copy size={12} /> 복사</>}
                </button>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-4 border border-gray-100">{v.content}</p>
              <p className="text-[11px] text-gray-400 mt-2 text-right">{v.content.length}자</p>
            </div>
          ))}

          {/* Copy all */}
          <button
            onClick={() => {
              const all = versions.map((v, i) => `[버전 ${i+1} — ${v.style}]\n${v.content}`).join('\n\n');
              navigator.clipboard.writeText(all);
            }}
            className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors"
          >
            전체 버전 복사
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <span>최근 생성 기록 ({history.length}개)</span>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-3">
              {history.map(record => (
                <div key={record.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{record.typeLabel}</span>
                      <span className="text-xs text-gray-500">{record.recipientName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">
                        {new Date(record.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                      <button
                        onClick={() => handleDeleteHistory(record.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {record.versions.slice(0, 1).map((v, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-[10px] text-gray-400 mt-1 shrink-0">{v.style}</span>
                        <p className="text-xs text-gray-600 line-clamp-2 flex-1">{v.content}</p>
                        <button
                          onClick={() => handleCopy(v.content, -1)}
                          className="shrink-0 p-1 text-gray-400 hover:text-violet-600 transition-colors"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setVersions(record.versions);
                      setSelectedType(record.type);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="mt-2 text-[11px] text-violet-600 hover:underline"
                  >
                    전체 버전 보기 →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
