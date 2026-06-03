'use client';
import { useState, KeyboardEvent, useEffect } from 'react';
import {
  FileText, Sparkles, Copy, CheckCheck, Loader2, ChevronDown,
  ChevronUp, Plus, X, Link2, Target, AlignLeft, Hash,
  MessageSquare, Wand2, Image as ImageIcon, Trash2, RefreshCw, Upload, Search, Crop, Download,
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

const WORD_COUNT_MARKS = [500, 1000, 1500, 2000, 3000];

interface BlogResult {
  title: string;
  body: string;
  metaDescription: string;
  tags: string[];
}

interface BlogImage {
  id: string;
  url: string;
  source: 'generate' | 'search' | 'upload' | '';
  label: string;
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
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<BlogResult | null>(null);
  const [copiedPart, setCopiedPart] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  // 이미지 갤러리 슬롯 상태 (1단계 & 2단계)
  const [imageCount, setImageCount] = useState(5);
  const [images, setImages] = useState<BlogImage[]>(() =>
    Array.from({ length: 5 }, (_, i) => ({ id: `img_${i + 1}`, url: '', source: '', label: '' }))
  );

  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  const updateResultField = (key: keyof BlogResult, value: any) => {
    setResult(prev => {
      if (!prev) return null;
      return { ...prev, [key]: value };
    });
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && result && !result.tags.includes(tag)) {
      updateResultField('tags', [...result.tags, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    if (result) {
      updateResultField('tags', result.tags.filter(t => t !== tagToRemove));
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const postId = searchParams.get('postId');
    if (!postId) return;

    const loadPost = async () => {
      try {
        const res = await fetch(`/api/blog-posts/${postId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (data.post) {
          const post = data.post;
          setCurrentPostId(post.id);
          setTopic(post.topic || '');
          setFormat(post.format || 'naver');
          setResult({
            title: post.title || '',
            body: post.body || '',
            metaDescription: post.meta_description || '',
            tags: post.tags || []
          });
          if (post.images_data && Array.isArray(post.images_data)) {
            setImages(post.images_data);
            setImageCount(post.images_data.length);
          }
        }
      } catch (err: any) {
        console.error('Failed to load blog post:', err);
        alert('블로그 글을 불러오는 데 실패했습니다: ' + err.message);
      }
    };

    loadPost();
  }, []);

  const handleImageCountChange = (newCount: number) => {
    if (newCount < 3 || newCount > 10) return;
    if (newCount < images.length) {
      const activeDiscarded = images.slice(newCount).some(img => img.url !== '');
      if (activeDiscarded) {
        alert("이미지가 채워진 슬롯이 삭제 범위에 포함되어 있어 개수를 줄일 수 없습니다. 이미지를 먼저 비우거나 더 큰 개수를 선택해주세요.");
        return;
      }
    }
    setImageCount(newCount);
    setImages(prev => {
      if (newCount > prev.length) {
        const added = Array.from({ length: newCount - prev.length }, (_, i) => ({
          id: `img_${prev.length + i + 1}`,
          url: '',
          source: '' as const,
          label: ''
        }));
        return [...prev, ...added];
      } else {
        return prev.slice(0, newCount);
      }
    });
  };

  // 모달 제어 상태 (2단계 & 3단계)
  const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);
  const [activeAction, setActiveAction] = useState<'generate' | 'search' | 'upload' | null>(null);

  const handleOpenAddModal = (index: number, action: 'generate' | 'search' | 'upload') => {
    setActiveSlotIdx(index);
    setActiveAction(action);
  };

  const handleSelectImage = (url: string) => {
    if (activeSlotIdx === null || !activeAction) return;
    setImages(prev => prev.map((img, idx) => idx === activeSlotIdx ? { ...img, url, source: activeAction } : img));
    setActiveSlotIdx(null);
    setActiveAction(null);
  };

  const handleClearSlot = (index: number) => {
    setImages(prev => prev.map((img, idx) => idx === index ? { ...img, url: '', source: '' } : img));
  };

  // 라벨 수동 생성, 크롭 및 다운로드 상태와 헬퍼 함수 (3단계)
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [activeCropSlotIdx, setActiveCropSlotIdx] = useState<number | null>(null);

  const handleAutoGenerateLabels = async () => {
    if (!result?.body) return;
    setLabelsLoading(true);
    try {
      const res = await fetch('/api/generate/blog-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogText: result.body, count: imageCount }),
      });
      const data = await res.json();
      if (data.labels) {
        setImages(prev => prev.map((img, i) => ({
          ...img,
          label: data.labels[i] || img.label || `슬롯 ${i + 1}`
        })));
      }
    } catch (err) {
      console.error('Failed to generate labels', err);
    } finally {
      setLabelsLoading(false);
    }
  };

  const handleDownloadSingle = async (url: string, index: number, label: string) => {
    try {
      const proxyUrl = url.startsWith('http') 
        ? `/api/proxy-image?url=${encodeURIComponent(url)}` 
        : url;
      const res = await fetch(proxyUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const cleanLabel = label.trim() ? label.replace(/[\s\/:*?"<>|]/g, '_') : 'image';
      a.download = `${index + 1}_${cleanLabel}.jpg`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.download = `${index + 1}_${label || 'image'}.jpg`;
      a.click();
    }
  };

  const handleDownloadAll = async () => {
    const activeImages = images.filter(img => img.url !== '');
    if (activeImages.length === 0) {
      alert("다운로드할 이미지가 등록된 슬롯이 없습니다.");
      return;
    }
    for (let i = 0; i < activeImages.length; i++) {
      const img = activeImages[i];
      const index = images.findIndex(x => x.id === img.id);
      await handleDownloadSingle(img.url, index, img.label);
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const handleSaveCrop = (croppedUrl: string) => {
    if (activeCropSlotIdx === null) return;
    setImages(prev => prev.map((img, idx) => idx === activeCropSlotIdx ? { ...img, url: croppedUrl } : img));
    setActiveCropSlotIdx(null);
  };

  const handleSave = async () => {
    if (!result?.body) return;
    setIsSaving(true);
    try {
      const url = currentPostId ? `/api/blog-posts/${currentPostId}` : '/api/blog-posts';
      const method = currentPostId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.title?.trim() || topic?.trim() || '제목 없는 블로그 글',
          body: result.body,
          metaDescription: result.metaDescription,
          tags: result.tags,
          images: images,
          topic: topic,
          format: format
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (!currentPostId && data.post?.id) {
        setCurrentPostId(data.post.id);
      }

      alert(currentPostId ? '수정되었습니다.' : '저장되었습니다.');
    } catch (e: any) {
      alert('저장 실패: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) { setError('주제를 입력해주세요'); return; }
    setError('');
    setIsGenerating(true);
    setResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 53000);

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
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);

      // 글 생성 후 비동기로 슬롯에 대한 AI 추천 라벨 자동 생성 발동 (3단계)
      fetch('/api/generate/blog-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogText: data.body, count: imageCount }),
      })
        .then(r => r.json())
        .then(labelData => {
          if (labelData.labels && labelData.labels.length > 0) {
            setImages(prev => prev.map((img, i) => ({
              ...img,
              label: labelData.labels[i] || img.label || `슬롯 ${i + 1}`
            })));
          }
        })
        .catch(err => console.error('Auto-label generate failed:', err));
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        setError('생성 실패: 대기 시간(53초)이 초과되어 취소되었습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError('생성 실패: ' + e.message);
      }
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
                      max={3000}
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

          <div className="p-4 pb-24 md:pb-4 border-t border-gray-100">
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
        <div className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6">
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white transition-all shadow-sm"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {isSaving ? '저장 중...' : '저장하기'}
                  </button>
                  <button
                    onClick={copyAll}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${copiedPart === 'all' ? 'bg-green-500 text-white' : 'bg-primary-50 text-primary-700 hover:bg-primary-100'}`}
                  >
                    {copiedPart === 'all' ? <CheckCheck size={14} /> : <Copy size={14} />}
                    {copiedPart === 'all' ? '복사됨!' : '전체 복사'}
                  </button>
                </div>
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
                <input
                  type="text"
                  value={result.title}
                  onChange={e => updateResultField('title', e.target.value)}
                  className="w-full font-bold text-gray-800 text-base border-b border-transparent focus:border-primary-400 outline-none bg-transparent py-1 transition-all"
                  placeholder="제목을 입력하세요"
                />
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
                <textarea
                  value={result.metaDescription}
                  onChange={e => updateResultField('metaDescription', e.target.value)}
                  rows={2}
                  className="w-full text-sm text-gray-600 border-b border-transparent focus:border-primary-400 outline-none bg-transparent py-1 resize-none transition-all"
                  placeholder="메타 설명을 입력하세요"
                />
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
                    onChange={e => updateResultField('body', e.target.value)}
                    rows={20}
                    className="w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 resize-y font-mono outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                  />
                ) : (
                  <textarea
                    value={result.body}
                    onChange={e => updateResultField('body', e.target.value)}
                    className="w-full text-sm text-gray-700 leading-relaxed bg-transparent border-0 border-b border-transparent focus:border-primary-400 focus:ring-0 outline-none resize-y min-h-[400px] font-sans"
                    placeholder="본문 내용을 입력하세요"
                  />
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
                <div className="flex flex-wrap gap-2 items-center">
                  {result.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-xs font-medium">
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors"><X size={10} /></button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="+ 태그 추가 (Enter)"
                    className="border border-dashed border-gray-200 rounded-full px-3 py-0.5 text-xs text-gray-500 hover:border-primary-300 focus:border-primary-400 outline-none w-32 transition-all bg-transparent"
                  />
                </div>
              </div>

              {/* 이미지 갤러리 섹션 (1단계 & 3단계 통합) */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                      <ImageIcon size={16} className="text-primary-500" /> 이미지 갤러리
                    </h3>
                    <p className="text-[11px] text-gray-400">블로그 본문에 사용할 이미지를 관리합니다</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleAutoGenerateLabels}
                      disabled={labelsLoading || !result?.body}
                      className="px-2.5 py-1 bg-primary-50 hover:bg-primary-100 disabled:opacity-50 text-primary-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      {labelsLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      AI 라벨 자동 추천
                    </button>
                    <button
                      onClick={handleDownloadAll}
                      className="px-2.5 py-1 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <Download size={12} /> 전체 다운로드
                    </button>
                    <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2">
                      <span className="text-xs text-gray-500 font-semibold">슬롯:</span>
                      <select
                        value={imageCount}
                        onChange={e => handleImageCountChange(Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                      >
                        {Array.from({ length: 8 }, (_, i) => i + 3).map(num => (
                          <option key={num} value={num}>{num}개</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((img, index) => {
                    const hasImage = img.url !== '';
                    return (
                      <div key={img.id} className="flex flex-col space-y-1">
                        <div
                          className="aspect-square bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center relative overflow-hidden transition-all group shadow-sm bg-cover bg-center"
                          style={hasImage ? { backgroundImage: `url(${img.url})` } : undefined}
                        >
                          {/* 슬롯 번호 배지 */}
                          <span className="absolute top-2 left-2 bg-gray-900/60 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center z-10 backdrop-blur-sm">
                            {index + 1}
                          </span>

                          {hasImage ? (
                            /* 이미지가 채워진 상태 */
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                              <span className="text-[9px] text-white/90 font-medium capitalize mb-0.5 bg-black/30 px-1.5 py-0.5 rounded-full text-center truncate max-w-full">
                                {img.source === 'generate' ? 'AI 생성' : img.source === 'search' ? '스톡 검색' : '직접 업로드'}
                              </span>
                              <div className="grid grid-cols-2 gap-1 w-full z-10">
                                <button
                                  onClick={() => handleOpenAddModal(index, img.source || 'search')}
                                  className="py-1 bg-white hover:bg-gray-100 text-gray-800 rounded-lg text-[9px] font-bold transition-colors flex items-center justify-center gap-0.5"
                                >
                                  <RefreshCw size={9} /> 교체
                                </button>
                                <button
                                  onClick={() => setActiveCropSlotIdx(index)}
                                  className="py-1 bg-white hover:bg-gray-100 text-gray-800 rounded-lg text-[9px] font-bold transition-colors flex items-center justify-center gap-0.5"
                                >
                                  <Crop size={9} /> 크롭
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-1 w-full z-10">
                                <button
                                  onClick={() => handleDownloadSingle(img.url, index, img.label)}
                                  className="py-1 bg-gray-800 hover:bg-gray-950 text-white rounded-lg text-[9px] font-bold transition-colors flex items-center justify-center gap-0.5"
                                >
                                  <Download size={9} /> 저장
                                </button>
                                <button
                                  onClick={() => handleClearSlot(index)}
                                  className="py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[9px] font-bold transition-colors flex items-center justify-center"
                                  title="비우기"
                                >
                                  <Trash2 size={9} /> 비우기
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* 이미지가 빈 상태 */
                            <>
                              <div className="flex flex-col items-center justify-center text-center space-y-1.5 mt-2 px-2">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:text-primary-500 transition-colors">
                                  <ImageIcon size={16} />
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10.5px] font-bold text-gray-600">이미지 추가</p>
                                  <p className="text-[9px] text-gray-400">슬롯 준비됨</p>
                                </div>
                              </div>

                              <div className="w-full grid grid-cols-3 gap-1 mt-auto p-2 border-t border-gray-100 bg-white animate-fade-in">
                                <button
                                  onClick={() => handleOpenAddModal(index, 'generate')}
                                  className="py-1 text-[9px] font-bold bg-primary-50 text-primary-700 border border-primary-100 rounded hover:bg-primary-100 transition-colors text-center"
                                  title="AI 이미지 생성"
                                >
                                  생성
                                </button>
                                <button
                                  onClick={() => handleOpenAddModal(index, 'search')}
                                  className="py-1 text-[9px] font-bold bg-gray-50 text-gray-700 border border-gray-200 rounded hover:bg-gray-100 transition-colors text-center"
                                  title="스톡 이미지 검색"
                                >
                                  검색
                                </button>
                                <button
                                  onClick={() => handleOpenAddModal(index, 'upload')}
                                  className="py-1 text-[9px] font-bold bg-gray-50 text-gray-700 border border-gray-200 rounded hover:bg-gray-100 transition-colors text-center"
                                  title="이미지 파일 업로드"
                                >
                                  업로드
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        {/* 직접 수정 가능한 섹션 라벨 인풋창 (3단계) */}
                        <input
                          type="text"
                          value={img.label}
                          onChange={e => {
                            const val = e.target.value;
                            setImages(prev => prev.map((x, idx) => idx === index ? { ...x, label: val } : x));
                          }}
                          placeholder={`슬롯 ${index + 1} 라벨 입력`}
                          className="w-full text-[10px] border border-gray-200 rounded-lg px-2 py-1 text-center outline-none focus:ring-2 focus:ring-primary-300 bg-white font-semibold text-gray-700"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 이미지 추가 모달 팝업 */}
              {activeAction !== null && activeSlotIdx !== null && (
                <ImageAddModal
                  actionType={activeAction}
                  blogText={result?.body || ''}
                  slotLabel={images[activeSlotIdx]?.label}
                  onSelect={handleSelectImage}
                  onClose={() => { setActiveSlotIdx(null); setActiveAction(null); }}
                />
              )}

              {/* 크롭 모달 팝업 (3단계) */}
              {activeCropSlotIdx !== null && (
                <CropModal
                  imageSrc={images[activeCropSlotIdx]?.url || ''}
                  onSave={handleSaveCrop}
                  onClose={() => setActiveCropSlotIdx(null)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 블로그용 이미지 추가 모달 (2단계 & 3단계 커스텀 복제 구현)
function ImageAddModal({
  actionType,
  blogText,
  slotLabel,
  onSelect,
  onClose,
}: {
  actionType: 'generate' | 'search' | 'upload';
  blogText: string;
  slotLabel?: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'search' | 'generate' | 'upload'>(actionType);
  const [hasApiKey, setHasApiKey] = useState(true);

  useEffect(() => {
    fetch('/api/generate/ai-image')
      .then(res => res.json())
      .then(data => {
        if (typeof data.hasKey === 'boolean') {
          setHasApiKey(data.hasKey);
        }
      })
      .catch(err => console.error('Failed to check Leonardo API key:', err));
  }, []);
  
  // 1. 검색 상태
  const [searchQuery, setSearchQuery] = useState(slotLabel ? slotLabel.replace(/.*-\s*/, '') : '');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPhotos, setSearchPhotos] = useState<string[]>([]);
  const [searchProvider, setSearchProvider] = useState<'unsplash' | 'pexels'>('unsplash');
  const [recommendLoading, setRecommendLoading] = useState(false);

  // 2. AI 생성 상태
  const [aiPrompt, setAiPrompt] = useState(slotLabel ? `A professional photo of ${slotLabel.replace(/.*-\s*/, '')}, high quality, beautiful lighting` : '');
  const [aiRatio, setAiRatio] = useState('1:1');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedUrls, setAiGeneratedUrls] = useState<string[]>([]);
  const [aiError, setAiError] = useState('');
  const [promptSuggestLoading, setPromptSuggestLoading] = useState(false);

  // AI 프롬프트 추천 (새로운 /api/suggest-image-prompt 라우트 호출)
  const handleRecommendPrompt = async () => {
    if (!blogText.trim()) return;
    setPromptSuggestLoading(true);
    try {
      const res = await fetch('/api/suggest-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogText, slotLabel }),
      });
      const data = await res.json();
      if (data.prompt) {
        setAiPrompt(data.prompt);
      }
    } catch (err) {
      console.error('Failed to suggest prompt:', err);
    } finally {
      setPromptSuggestLoading(false);
    }
  };

  // 3. 업로드 상태
  const [uploadLoading, setUploadLoading] = useState(false);

  // AI 검색어 추천 (3단계: slotLabel 힌트 연결)
  const handleRecommendKeyword = async () => {
    if (!blogText.trim()) return;
    setRecommendLoading(true);
    try {
      const res = await fetch('/api/suggest-image-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cardContent: slotLabel 
            ? `[슬롯 라벨(우선순위)]: ${slotLabel}\n\n[블로그 본문 참고]: ${blogText.slice(0, 800)}`
            : blogText.slice(0, 1000)
        }),
      });
      const data = await res.json();
      if (data.query) {
        setSearchQuery(data.query);
        handleSearch(data.query, searchProvider);
      }
    } catch {
      // ignore
    } finally {
      setRecommendLoading(false);
    }
  };

  // 스톡 이미지 검색
  const handleSearch = async (query: string, provider: 'unsplash' | 'pexels') => {
    if (!query.trim()) return;
    setSearchLoading(true);
    try {
      if (provider === 'unsplash') {
        const res = await fetch(`/api/images/search?query=${encodeURIComponent(query)}&per_page=9&page=1`);
        const data = await res.json();
        setSearchPhotos((data.photos || []).map((p: any) => p.urls?.regular || p.url));
      } else {
        const res = await fetch(`/api/pexels?query=${encodeURIComponent(query)}&page=1&per_page=9`);
        const data = await res.json();
        setSearchPhotos((data.photos || []).map((p: any) => p.src?.large || p.url));
      }
    } catch {
      // ignore
    } finally {
      setSearchLoading(false);
    }
  };

  // AI 이미지 생성
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiGenerating) return;
    setAiGenerating(true);
    setAiError('');
    setAiGeneratedUrls([]);
    try {
      const res = await fetch('/api/generate/ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, ratio: aiRatio, count: 1 }),
      });
      const data = await res.json();
      if (data.error) {
        setAiError(data.error);
        return;
      }
      setAiGeneratedUrls(data.urls || []);
    } catch (e: any) {
      setAiError(e.message || 'AI 생성 실패');
    } finally {
      setAiGenerating(false);
    }
  };

  // 파일 직접 업로드
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: form });
      const data = await res.json();
      if (data.url) {
        onSelect(data.url);
      } else {
        throw new Error('No URL returned');
      }
    } catch {
      // Fallback base64
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onSelect(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
            <ImageIcon size={16} className="text-primary-500" /> 이미지 라이브러리 추가
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-100 shrink-0">
          {(['search', 'generate', 'upload'] as const).map(t => {
            const label = t === 'search' ? '스톡 검색' : t === 'generate' ? 'AI 이미지 생성' : '직접 업로드';
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-colors ${tab === t ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600 bg-gray-50/30'}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 min-h-[300px]">
          {tab === 'search' && (
            <div className="space-y-4">
              <div className="flex gap-2 items-center justify-between">
                <button
                  onClick={handleRecommendKeyword}
                  disabled={recommendLoading}
                  className="flex items-center gap-1 px-3 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg text-xs font-bold transition-all disabled:opacity-60"
                >
                  {recommendLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  AI 추천 검색어 {slotLabel && `(${slotLabel.slice(0, 10)}...)`}
                </button>
                <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
                  <button onClick={() => { setSearchProvider('unsplash'); setSearchPhotos([]); handleSearch(searchQuery, 'unsplash'); }} className={`px-2.5 py-1.5 font-bold ${searchProvider === 'unsplash' ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Unsplash</button>
                  <button onClick={() => { setSearchProvider('pexels'); setSearchPhotos([]); handleSearch(searchQuery, 'pexels'); }} className={`px-2.5 py-1.5 font-bold ${searchProvider === 'pexels' ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Pexels</button>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearch(searchQuery, searchProvider); }}
                  placeholder="영어 키워드 권장 (예: business workspace)"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary-300 outline-none"
                />
                <button
                  onClick={() => handleSearch(searchQuery, searchProvider)}
                  disabled={searchLoading}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-950 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-60 flex items-center gap-1"
                >
                  {searchLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                  검색
                </button>
              </div>

              {searchLoading && searchPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                  <Loader2 size={24} className="animate-spin text-primary-400" />
                  <p className="text-xs">스톡 이미지를 검색 중입니다...</p>
                </div>
              ) : searchPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {searchPhotos.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => onSelect(url)}
                      className="aspect-square rounded-lg overflow-hidden border border-gray-100 hover:border-primary-500 transition-all hover:scale-[1.02]"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400 text-xs">
                  검색어를 입력하고 검색해보세요. (AI 추천 키워드를 사용하면 슬롯 라벨에 부합하는 키워드가 추천됩니다)
                </div>
              )}
            </div>
          )}

          {tab === 'generate' && (
            <div className="space-y-4">
              {/* API 키가 없는 경우 안내 문구 노출 */}
              {!hasApiKey && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1">⚠️ AI 이미지 생성 기능 준비 중</p>
                  <p>현재 AI 이미지 생성 기능은 시스템 준비 중입니다. 당분간은 상단 탭에서 <strong>스톡 검색</strong> 또는 <strong>직접 업로드</strong> 기능을 이용해주세요.</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-600">생성할 이미지 프롬프트</label>
                  <button
                    onClick={handleRecommendPrompt}
                    disabled={promptSuggestLoading || !blogText.trim()}
                    className="flex items-center gap-1 px-2.5 py-1 bg-primary-50 hover:bg-primary-100 disabled:opacity-60 text-primary-700 rounded-lg text-[10px] font-bold transition-all"
                  >
                    {promptSuggestLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    AI 프롬프트 추천 {slotLabel && `(${slotLabel.slice(0, 8)}...)`}
                  </button>
                </div>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="영어로 상세하게 묘사해주세요 (예: A high-tech professional office desk with a laptop and warm lighting)"
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary-300 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['1:1', '4:5', '9:16'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setAiRatio(r)}
                    disabled={!hasApiKey}
                    className={`py-1.5 text-[11px] font-bold border rounded-lg transition-all ${!hasApiKey ? 'opacity-50 cursor-not-allowed border-gray-200 text-gray-400 bg-white' : aiRatio === r ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                  >
                    비율 {r}
                  </button>
                ))}
              </div>

              <button
                onClick={handleAiGenerate}
                disabled={aiGenerating || !aiPrompt.trim() || !hasApiKey}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {!hasApiKey ? 'AI 이미지 생성 준비 중' : aiGenerating ? 'AI 이미지 생성 중...' : '이미지 생성하기'}
              </button>

              {aiError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{aiError}</p>}

              {aiGeneratedUrls.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-xs font-bold text-gray-500 mb-2">생성 결과 (선택하려면 클릭)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {aiGeneratedUrls.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => onSelect(url)}
                        className="aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-primary-500 transition-all hover:scale-[1.02] shadow"
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100/50 transition-colors relative cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploadLoading}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center text-center space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-400 group-hover:text-primary-500 transition-colors shadow-sm">
                  {uploadLoading ? <Loader2 size={20} className="animate-spin text-primary-400" /> : <Upload size={20} />}
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-gray-600">이미지 파일을 여기에 업로드</p>
                  <p className="text-[10px] text-gray-400">클릭하거나 이미지 파일을 끌어다 놓으세요</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 블로그 전용 이미지 크롭 컴포넌트 (3단계: 카드뉴스 회귀 위험 차단 및 완전한 격리)
function CropModal({
  imageSrc,
  onSave,
  onClose,
}: {
  imageSrc: string;
  onSave: (croppedUrl: string) => void;
  onClose: () => void;
}) {
  const [ratio, setRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('1:1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCrop = async () => {
    setLoading(true);
    setError('');
    try {
      const img = new Image();
      // CORS 우회 설정
      img.crossOrigin = 'anonymous';
      
      const proxyUrl = imageSrc.startsWith('http')
        ? `/api/proxy-image?url=${encodeURIComponent(imageSrc)}`
        : imageSrc;
      
      img.src = proxyUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('이미지를 로드하는 중 오류가 발생했습니다. CORS 정책을 확인하거나 다시 시도해주세요.'));
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context 생성 실패');

      let targetRatio = 1;
      if (ratio === '4:5') targetRatio = 4 / 5;
      else if (ratio === '9:16') targetRatio = 9 / 16;
      else if (ratio === '16:9') targetRatio = 16 / 9;

      const imgWidth = img.naturalWidth || img.width;
      const imgHeight = img.naturalHeight || img.height;

      let sWidth = imgWidth;
      let sHeight = imgHeight;
      let sx = 0;
      let sy = 0;

      // 중앙 크롭 영역 산출
      const currentRatio = imgWidth / imgHeight;
      if (currentRatio > targetRatio) {
        sWidth = imgHeight * targetRatio;
        sx = (imgWidth - sWidth) / 2;
      } else {
        sHeight = imgWidth / targetRatio;
        sy = (imgHeight - sHeight) / 2;
      }

      canvas.width = sWidth;
      canvas.height = sHeight;

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      onSave(croppedDataUrl);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '크롭 가공 중 장애가 일어났습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
            <Crop size={16} className="text-primary-500" /> 이미지 크롭
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Preview Area */}
        <div className="p-5 flex-1 flex flex-col items-center justify-center gap-4 bg-gray-50 min-h-[300px]">
          <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-white max-h-[250px] w-full flex items-center justify-center">
            <img src={imageSrc} alt="Preview" className="max-h-[250px] object-contain" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div 
                className="border-2 border-primary-500 bg-primary-500/10 transition-all duration-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                style={{
                  aspectRatio: ratio === '1:1' ? '1' : ratio === '4:5' ? '4/5' : ratio === '9:16' ? '9/16' : '16/9',
                  width: ratio === '9:16' ? '40%' : ratio === '4:5' ? '60%' : '75%',
                  maxHeight: '100%',
                }}
              />
            </div>
          </div>

          {/* Ratios Options */}
          <div className="w-full space-y-2">
            <p className="text-xs font-bold text-gray-500 text-center">크롭 비율 선택</p>
            <div className="grid grid-cols-4 gap-2">
              {(['1:1', '4:5', '9:16', '16:9'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRatio(r)}
                  className={`py-2 text-xs font-bold border rounded-xl transition-all ${ratio === r ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-100 bg-white'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 w-full text-center">{error}</p>}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-600 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleCrop}
            disabled={loading}
            className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Crop size={12} />}
            크롭 완료 및 적용
          </button>
        </div>
      </div>
    </div>
  );
}
