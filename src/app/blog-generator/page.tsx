'use client';
import { useState } from 'react';
import { FileText, Sparkles, Copy, CheckCheck, Loader2, ExternalLink, ChevronDown } from 'lucide-react';

const FORMATS = [
  { id: 'naver', label: '네이버 블로그', icon: '🟢', desc: '이모지+가독성 중심, 해시태그', color: 'border-green-400 bg-green-50 text-green-700' },
  { id: 'tistory', label: '티스토리 / 워드프레스', icon: '🔵', desc: 'SEO 최적화, 전문적, 마크다운', color: 'border-blue-400 bg-blue-50 text-blue-700' },
  { id: 'instagram', label: '인스타 블로그 캡처용', icon: '🟣', desc: '짧고 임팩트, 이모지 활용', color: 'border-purple-400 bg-purple-50 text-purple-700' },
];

const TONE_OPTIONS = [
  { value: '', label: '페르소나 설정 따름' },
  { value: 'friendly', label: '친근한 말투' },
  { value: 'professional', label: '전문적인 말투' },
  { value: 'trendy', label: '트렌디한 말투' },
  { value: 'emotional', label: '감성적인 말투' },
];

interface BlogResult {
  title: string;
  body: string;
  metaDescription: string;
  tags: string[];
}

export default function BlogGeneratorPage() {
  const [content, setContent] = useState('');
  const [format, setFormat] = useState('naver');
  const [tone, setTone] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<BlogResult | null>(null);
  const [copiedPart, setCopiedPart] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  const handleGenerate = async () => {
    if (!content.trim()) { setError('내용을 입력해주세요'); return; }
    setError('');
    setIsGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/generate/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, format, tone }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError('생성 실패: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copy = (part: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPart(part);
    setTimeout(() => setCopiedPart(null), 2000);
  };

  const copyAll = () => {
    if (!result) return;
    const full = `[제목]\n${result.title}\n\n[본문]\n${result.body}\n\n[메타설명]\n${result.metaDescription}\n\n[태그]\n${result.tags.join(', ')}`;
    copy('all', full);
  };

  const selectedFormat = FORMATS.find(f => f.id === format);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-5 shrink-0">
        <h1 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2 ml-10 md:ml-0">
          <FileText size={20} className="text-primary-500" /> 블로그 글 자동 생성
        </h1>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5 ml-10 md:ml-0">카드뉴스 내용 → 2000자 이상 SEO 최적화 블로그 포스트</p>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-auto md:overflow-hidden">
        {/* Left: Input */}
        <div className="w-full md:w-[400px] bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">원본 내용</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="카드뉴스 내용, 주제, 요약 내용을 붙여넣거나 입력하세요&#10;&#10;짧은 내용이어도 AI가 2000자 이상으로 확장합니다."
                rows={10}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{content.length}자 입력</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">블로그 플랫폼</label>
              <div className="space-y-2">
                {FORMATS.map(f => (
                  <button key={f.id} onClick={() => setFormat(f.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${format === f.id ? f.color : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                    <span className="text-xl">{f.icon}</span>
                    <div>
                      <p className={`text-sm font-bold ${format === f.id ? '' : 'text-gray-700'}`}>{f.label}</p>
                      <p className="text-xs opacity-60">{f.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">글쓰기 톤 (선택)</label>
              <select
                value={tone}
                onChange={e => setTone(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
              >
                {TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          </div>

          <div className="p-4 border-t border-gray-100">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isGenerating ? '생성 중... (15-30초)' : `${selectedFormat?.label} 블로그 생성`}
            </button>
          </div>
        </div>

        {/* Right: Result */}
        <div className="flex-1 overflow-y-auto p-6">
          {!result && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <FileText size={28} className="text-gray-300" />
              </div>
              <p className="font-bold text-gray-500">왼쪽에 내용을 입력하고</p>
              <p className="text-sm mt-1">블로그 플랫폼을 선택한 후 생성해주세요</p>
            </div>
          )}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Loader2 size={32} className="animate-spin text-primary-400" />
              <p className="text-sm font-medium">AI가 블로그 글을 작성 중입니다...</p>
              <p className="text-xs">2000자 이상 SEO 최적화 글 생성 중 (15-30초)</p>
            </div>
          )}
          {result && (
            <div className="max-w-2xl space-y-4">
              {/* Top actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedFormat?.icon}</span>
                  <span className="font-bold text-gray-700 text-sm">{selectedFormat?.label}</span>
                  <span className="text-xs text-gray-400">· {result.body.length}자</span>
                </div>
                <button
                  onClick={copyAll}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${copiedPart === 'all' ? 'bg-green-500 text-white' : 'bg-primary-50 text-primary-700 hover:bg-primary-100'}`}
                >
                  {copiedPart === 'all' ? <CheckCheck size={14} /> : <Copy size={14} />}
                  {copiedPart === 'all' ? '전체 복사됨!' : '전체 복사'}
                </button>
              </div>

              {/* Title */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-400 uppercase">제목 (SEO 최적화)</p>
                  <button onClick={() => copy('title', result.title)}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${copiedPart === 'title' ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
                    {copiedPart === 'title' ? <CheckCheck size={11} /> : <Copy size={11} />} 복사
                  </button>
                </div>
                <p className="font-bold text-gray-800 text-base">{result.title}</p>
              </div>

              {/* Meta */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-400 uppercase">메타 설명 ({result.metaDescription.length}자)</p>
                  <button onClick={() => copy('meta', result.metaDescription)}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${copiedPart === 'meta' ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
                    {copiedPart === 'meta' ? <CheckCheck size={11} /> : <Copy size={11} />} 복사
                  </button>
                </div>
                <p className="text-sm text-gray-600">{result.metaDescription}</p>
              </div>

              {/* Body */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase">본문 ({result.body.length}자)</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowPreview(v => !v)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100">
                      {showPreview ? '원문 보기' : '미리보기'} <ChevronDown size={11} />
                    </button>
                    <button onClick={() => copy('body', result.body)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${copiedPart === 'body' ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
                      {copiedPart === 'body' ? <CheckCheck size={11} /> : <Copy size={11} />} 복사
                    </button>
                  </div>
                </div>
                {showPreview ? (
                  <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line text-sm">
                    {result.body}
                  </div>
                ) : (
                  <textarea
                    value={result.body}
                    readOnly
                    rows={20}
                    className="w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 resize-none font-mono"
                  />
                )}
              </div>

              {/* Tags */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">태그</p>
                <div className="flex flex-wrap gap-2">
                  {result.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium border border-primary-200">#{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
