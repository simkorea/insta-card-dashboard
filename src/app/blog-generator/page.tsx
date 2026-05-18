'use client';
import { useState, KeyboardEvent } from 'react';
import {
  FileText, Sparkles, Copy, CheckCheck, Loader2, ChevronDown,
  ChevronUp, Plus, X, Link2, Target, AlignLeft, Hash,
  MessageSquare, Wand2,
} from 'lucide-react';

const FORMATS = [
  { id: 'naver', label: '네이버 블로그', icon: '🟢', desc: '이모지+가독성 중심, 해시태그' },
  { id: 'tistory', label: '티스토리 / 워드프레스', icon: '🔵', desc: 'SEO 최적화, 전문적' },
  { id: 'instagram', label: '인스타 캡처용', icon: '🟣', desc: '짧고 임팩트, 이모지' },
];

const TONE_OPTIONS = [
  { value: 'professional', label: '전문적' },
  { value: 'friendly', label: '친근한' },
  { value: 'trendy', label: '트렌디' },
  { value: 'emotional', label: '감성적' },
  { value: 'informative', label: '정보전달형' },
  { value: 'persuasive', label: '설득형' },
];

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: '입력 내용 따라 자동 감지' },
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
];

const SUGGESTED_TOPICS = [
  'AI 콘텐츠 자동화의 미래',
  'SNS 마케팅 실전 노하우',
  '개인 브랜딩으로 커리어 성장하기',
  '스타트업 성장 전략 가이드',
  '디지털 노마드 생활 가이드',
];

const WORD_COUNT_MARKS = [500, 1000, 2000, 3000, 5000];

interface BlogResult {
  title: string;
  body: string;
  metaDescription: string;
  tags: string[];
}

export default function BlogGeneratorPage() {
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState('naver');
  const [tone, setTone] = useState('professional');
  const [language, setLanguage] = useState('auto');
  const [targetAudience, setTargetAudience] = useState('');
  const [wordCount, setWordCount] = useState(2000);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [refLinks, setRefLinks] = useState<string[]>(['']);
  const [instructions, setInstructions] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<BlogResult | null>(null);
  const [copiedPart, setCopiedPart] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) { setError('주제를 입력해주세요'); return; }
    setError('');
    setIsGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/generate/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          format,
          tone,
          language,
          targetAudience,
          wordCount,
          keywords,
          refLinks: refLinks.filter(l => l.trim()),
          instructions,
          cta: ctaText ? { text: ctaText, url: ctaUrl } : null,
        }),
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

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw]);
    }
    setKeywordInput('');
  };

  const handleKeywordKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addKeyword(); }
  };

  const removeKeyword = (kw: string) => setKeywords(prev => prev.filter(k => k !== kw));

  const addRefLink = () => {
    if (refLinks.length < 3) setRefLinks(prev => [...prev, '']);
  };

  const updateRefLink = (i: number, val: string) => {
    setRefLinks(prev => prev.map((l, idx) => idx === i ? val : l));
  };

  const removeRefLink = (i: number) => {
    setRefLinks(prev => prev.filter((_, idx) => idx !== i));
  };

  const selectedFormat = FORMATS.find(f => f.id === format);

  const wordCountLabel = wordCount >= 1000 ? `약 ${(wordCount / 1000).toFixed(wordCount % 1000 === 0 ? 0 : 1)}천자` : `약 ${wordCount}자`;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 shrink-0">
        <h1 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2 ml-10 md:ml-0">
          <FileText size={20} className="text-primary-500" /> 블로그 글 자동 생성
        </h1>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5 ml-10 md:ml-0">주제만 입력하면 AI가 SEO 최적화 블로그 글을 완성합니다</p>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-auto md:overflow-hidden">
        {/* Left: Input */}
        <div className="w-full md:w-[420px] bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Topic input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">블로그 주제</label>
              <p className="text-xs text-gray-400 mb-2">주제만 입력하면 AI가 리서치부터 글 작성까지 해드려요</p>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="블로그 주제를 입력하세요 (예: AI 콘텐츠 자동화의 미래)"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none resize-none"
              />
              {/* Suggested topics */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SUGGESTED_TOPICS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    className="text-[11px] px-2.5 py-1 bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-600 rounded-full transition-colors font-medium"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">블로그 플랫폼</label>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map(f => (
                  <button key={f.id} onClick={() => setFormat(f.id)}
                    className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 text-center transition-all ${format === f.id ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                    <span className="text-xl">{f.icon}</span>
                    <p className={`text-[11px] font-bold leading-tight ${format === f.id ? 'text-primary-700' : 'text-gray-700'}`}>{f.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Language + Tone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">글 작성 언어</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                >
                  {LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">글 분위기</label>
                <select
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                >
                  {TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Advanced settings */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Wand2 size={14} className="text-gray-400" />
                  <span>세부 설정</span>
                  <span className="text-[10px] text-gray-400 font-normal">언어, 분위기, 키워드 등 커스터마이즈</span>
                </div>
                {showAdvanced ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>

              {showAdvanced && (
                <div className="p-4 border-t border-gray-100 space-y-4">
                  {/* Target audience */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5">
                      <Target size={12} /> 대상 독자 (선택)
                    </label>
                    <input
                      type="text"
                      value={targetAudience}
                      onChange={e => setTargetAudience(e.target.value)}
                      placeholder="예: SNS 마케팅을 시작하는 소상공인"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                    />
                  </div>

                  {/* Word count */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                        <AlignLeft size={12} /> 원하는 분량
                      </label>
                      <span className="text-xs font-bold text-primary-600">{wordCountLabel} 분량</span>
                    </div>
                    <input
                      type="range"
                      min={500}
                      max={5000}
                      step={500}
                      value={wordCount}
                      onChange={e => setWordCount(Number(e.target.value))}
                      className="w-full accent-primary-600"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                      {WORD_COUNT_MARKS.map(m => <span key={m}>{m >= 1000 ? `${m / 1000}천` : m}</span>)}
                    </div>
                  </div>

                  {/* Search keywords */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5">
                      <Hash size={12} /> 검색 키워드 (선택)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={keywordInput}
                        onChange={e => setKeywordInput(e.target.value)}
                        onKeyDown={handleKeywordKey}
                        placeholder="키워드 입력 후 Enter"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                      />
                      <button onClick={addKeyword} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-600 transition-colors">추가</button>
                    </div>
                    {keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {keywords.map(kw => (
                          <span key={kw} className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-full font-medium">
                            #{kw}
                            <button onClick={() => removeKeyword(kw)} className="hover:text-red-500 transition-colors"><X size={10} /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reference links */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                        <Link2 size={12} /> 참고 링크 (선택, 최대 3개)
                      </label>
                      {refLinks.length < 3 && (
                        <button onClick={addRefLink} className="flex items-center gap-0.5 text-[11px] text-primary-600 font-bold hover:text-primary-700">
                          <Plus size={11} /> URL
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {refLinks.map((link, i) => (
                        <div key={i} className="flex gap-1.5">
                          <input
                            type="url"
                            value={link}
                            onChange={e => updateRefLink(i, e.target.value)}
                            placeholder="https://example.com"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                          />
                          {refLinks.length > 1 && (
                            <button onClick={() => removeRefLink(i)} className="px-2 text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Additional instructions */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5">
                      <MessageSquare size={12} /> 추가 지시사항 (선택)
                    </label>
                    <textarea
                      value={instructions}
                      onChange={e => setInstructions(e.target.value)}
                      placeholder="꼭 다뤄야 할 내용, 피해야 할 내용, 제품/서비스 언급 등"
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none resize-none"
                    />
                  </div>

                  {/* CTA */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">행동 유도 CTA (선택)</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={ctaText}
                        onChange={e => setCtaText(e.target.value)}
                        placeholder="예: 무료로 시작하기"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                      />
                      <input
                        type="url"
                        value={ctaUrl}
                        onChange={e => setCtaUrl(e.target.value)}
                        placeholder="https://your-site.com"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          </div>

          <div className="p-4 border-t border-gray-100">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isGenerating ? '생성 중... (15-30초)' : '글 생성 시작'}
            </button>
            {!topic.trim() && <p className="text-center text-xs text-gray-400 mt-2">주제를 입력해주세요</p>}
          </div>
        </div>

        {/* Right: Result */}
        <div className="flex-1 overflow-y-auto p-6">
          {!result && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-3">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                <FileText size={28} className="text-gray-300" />
              </div>
              <div>
                <p className="font-bold text-gray-500">왼쪽에 블로그 주제를 입력하고</p>
                <p className="text-sm mt-1">플랫폼을 선택한 후 생성해주세요</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 max-w-sm w-full">
                {[
                  { icon: '🎯', label: '주제 입력', desc: '한 문장이면 충분' },
                  { icon: '⚙️', label: '세부 설정', desc: '톤, 키워드, 분량' },
                  { icon: '✨', label: 'AI 생성', desc: 'SEO 최적화 완성' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                    <div className="text-2xl mb-1">{s.icon}</div>
                    <p className="text-xs font-bold text-gray-700">{s.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
              <div className="relative">
                <Loader2 size={36} className="animate-spin text-primary-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-600">AI가 블로그 글을 작성 중입니다...</p>
                <p className="text-xs mt-1">리서치 → 구성 → 본문 작성 → SEO 최적화</p>
              </div>
              <div className="flex gap-1.5 mt-2">
                {['주제 분석', '구조 설계', '본문 작성', 'SEO 적용'].map(step => (
                  <span key={step} className="text-[10px] px-2 py-1 bg-primary-50 text-primary-600 rounded-full font-medium">{step}</span>
                ))}
              </div>
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
                  {copiedPart === 'all' ? '복사됨!' : '전체 복사'}
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
                    <button onClick={() => setShowRaw(v => !v)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100">
                      {showRaw ? '미리보기' : '원문 보기'} <ChevronDown size={11} />
                    </button>
                    <button onClick={() => copy('body', result.body)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${copiedPart === 'body' ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
                      {copiedPart === 'body' ? <CheckCheck size={11} /> : <Copy size={11} />} 복사
                    </button>
                  </div>
                </div>
                {showRaw ? (
                  <textarea
                    value={result.body}
                    readOnly
                    rows={20}
                    className="w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 resize-none font-mono"
                  />
                ) : (
                  <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line text-sm">
                    {result.body}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-400 uppercase">태그</p>
                  <button onClick={() => copy('tags', result.tags.map(t => `#${t}`).join(' '))}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${copiedPart === 'tags' ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
                    {copiedPart === 'tags' ? <CheckCheck size={11} /> : <Copy size={11} />} 복사
                  </button>
                </div>
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
