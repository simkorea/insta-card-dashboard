'use client';
import { useState } from 'react';
import { Sparkles, Copy, CheckCheck, Loader2, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';

const IgIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>;
const LiIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>;
const XIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
const FbIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>;

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: <IgIcon />, color: 'from-pink-500 to-purple-600', bg: 'bg-gradient-to-r from-pink-50 to-purple-50', border: 'border-pink-200', text: 'text-pink-700', limit: '300-500자', hashtag: '15-20개' },
  { id: 'threads', label: 'Threads', icon: <MessageCircle size={14} />, color: 'from-gray-700 to-gray-900', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', limit: '150-250자', hashtag: '3-5개' },
  { id: 'linkedin', label: 'LinkedIn', icon: <LiIcon />, color: 'from-blue-600 to-blue-800', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', limit: '400-600자', hashtag: '3-5개' },
  { id: 'twitter', label: 'X (Twitter)', icon: <XIcon />, color: 'from-gray-800 to-black', bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-800', limit: '140자', hashtag: '1-2개' },
  { id: 'facebook', label: 'Facebook', icon: <FbIcon />, color: 'from-blue-500 to-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', limit: '300-400자', hashtag: '최소' },
];

interface CaptionResult {
  caption: string;
  hashtags: string;
}

export default function SocialPostPage() {
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram', 'threads', 'linkedin']);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<Record<string, CaptionResult>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) { setError('내용을 입력해주세요'); return; }
    if (selectedPlatforms.length === 0) { setError('플랫폼을 최소 1개 선택해주세요'); return; }
    setError('');
    setIsGenerating(true);
    setResults({});
    try {
      const slides = [{ title: inputText.slice(0, 100), body: inputText }];
      const res = await fetch('/api/generate/multi-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides, platforms: selectedPlatforms }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.captions || {});
      setExpandedId(selectedPlatforms[0]);
    } catch (e: any) {
      setError('생성 실패: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasResults = Object.keys(results).length > 0;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-5 shrink-0">
        <h1 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2 ml-10 md:ml-0">
          <Sparkles size={20} className="text-primary-500" /> 소셜 포스트 멀티플랫폼 최적화
        </h1>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5 ml-10 md:ml-0">하나의 콘텐츠를 각 플랫폼 특성에 맞게 자동 변환합니다</p>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-auto md:overflow-hidden gap-0">
        {/* Left: Input */}
        <div className="w-full md:w-[420px] bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">콘텐츠 내용 입력</label>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="카드뉴스 내용, 주제, 키메시지를 입력하세요&#10;&#10;예) 오늘의 주제: 재테크 초보자를 위한 5가지 절약 습관&#10;- 자동이체 설정으로 강제 저축&#10;- 지출 가계부 앱 활용..."
                rows={10}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{inputText.length}자</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">발행할 플랫폼 선택</label>
              <div className="space-y-2">
                {PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${selectedPlatforms.includes(p.id) ? `${p.bg} ${p.border}` : 'border-gray-100 bg-white hover:border-gray-200'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg bg-gradient-to-br ${p.color} text-white`}>{p.icon}</div>
                      <div className="text-left">
                        <p className={`text-sm font-bold ${selectedPlatforms.includes(p.id) ? p.text : 'text-gray-600'}`}>{p.label}</p>
                        <p className="text-xs text-gray-400">{p.limit} · 해시태그 {p.hashtag}</p>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${selectedPlatforms.includes(p.id) ? 'bg-primary-500 border-primary-500' : 'border-gray-300'}`}>
                      {selectedPlatforms.includes(p.id) && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          </div>

          <div className="p-4 border-t border-gray-100">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || selectedPlatforms.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isGenerating ? '생성 중...' : `${selectedPlatforms.length}개 플랫폼 캡션 생성`}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {!hasResults && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles size={28} className="text-gray-300" />
              </div>
              <p className="font-bold text-gray-500">왼쪽에서 내용을 입력하고</p>
              <p className="text-sm mt-1">플랫폼을 선택한 후 생성 버튼을 눌러주세요</p>
            </div>
          )}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Loader2 size={32} className="animate-spin text-primary-400" />
              <p className="text-sm font-medium">{selectedPlatforms.length}개 플랫폼 최적화 중...</p>
            </div>
          )}
          {hasResults && (
            <div className="space-y-4 max-w-2xl">
              {PLATFORMS.filter(p => results[p.id]).map(p => {
                const r = results[p.id];
                const isExpanded = expandedId === p.id;
                const fullText = `${r.caption}\n\n${r.hashtags}`;
                return (
                  <div key={p.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${p.border}`}>
                    {/* Platform header */}
                    <div className={`flex items-center justify-between px-5 py-3 ${p.bg}`}>
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${p.color} text-white`}>{p.icon}</div>
                        <span className={`font-bold text-sm ${p.text}`}>{p.label}</span>
                        <span className="text-xs text-gray-400">{r.caption.length}자</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(p.id, fullText)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${copiedId === p.id ? 'bg-green-500 text-white' : `${p.bg} ${p.text} hover:opacity-80 border ${p.border}`}`}
                        >
                          {copiedId === p.id ? <CheckCheck size={12} /> : <Copy size={12} />}
                          {copiedId === p.id ? '복사됨!' : '복사'}
                        </button>
                        <button onClick={() => setExpandedId(isExpanded ? null : p.id)} className="text-gray-400 hover:text-gray-600">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="p-5 space-y-3">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1.5">캡션</p>
                          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{r.caption}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1.5">해시태그</p>
                          <p className="text-sm text-primary-600 leading-relaxed">{r.hashtags}</p>
                        </div>
                      </div>
                    )}
                    {!isExpanded && (
                      <div className="px-5 py-3">
                        <p className="text-sm text-gray-600 line-clamp-2">{r.caption}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
