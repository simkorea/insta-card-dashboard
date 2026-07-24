'use client';
import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Upload, Sparkles, ExternalLink, Copy, CheckCheck } from 'lucide-react';

interface CardnewsDraft {
  headline: string;
  sub: string;
  slides: string[];
  cta: string;
}

interface AiAnalysis {
  core_message: string;
  structure: string[];
  hooks: string[];
  cardnews_draft: CardnewsDraft;
}

interface ReferenceAd {
  id: string;
  source: 'search' | 'upload';
  keyword: string | null;
  advertiser_name: string | null;
  ad_text: string | null;
  media_url: string | null;
  landing_domain: string | null;
  library_id: string | null;
  started_at: string | null;
  ai_analysis: AiAnalysis | null;
  created_at: string;
}

interface Persona {
  id: string;
  persona_name: string;
}

export default function ReferenceResearchPage() {
  const [items, setItems] = useState<ReferenceAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [keyword, setKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [uploadAdvertiser, setUploadAdvertiser] = useState('');
  const [uploadText, setUploadText] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaId, setPersonaId] = useState('');
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reference-research');
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetch('/api/brand-persona')
      .then(res => res.json())
      .then(data => setPersonas(data.personas || []))
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setIsSearching(true);
    setSearchError('');
    try {
      const res = await fetch('/api/reference-research/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '검색 실패');
      await load();
    } catch (e: any) {
      setSearchError(e.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile && !uploadText.trim()) {
      setUploadError('이미지나 설명 중 하나는 입력해주세요');
      return;
    }
    setIsUploading(true);
    setUploadError('');
    try {
      let mediaUrl: string | null = null;
      if (uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        const uploadRes = await fetch('/api/upload-image', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || '이미지 업로드 실패');
        mediaUrl = uploadData.url;
      }

      const res = await fetch('/api/reference-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advertiserName: uploadAdvertiser, adText: uploadText, mediaUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '등록 실패');

      setUploadAdvertiser('');
      setUploadText('');
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowUpload(false);
      await load();
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async (id: string) => {
    setAnalyzingId(id);
    setAnalyzeError(prev => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch('/api/reference-research/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, personaId: personaId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분석 실패');
      setItems(prev => prev.map(i => (i.id === id ? data.item : i)));
    } catch (e: any) {
      setAnalyzeError(prev => ({ ...prev, [id]: e.message }));
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleCopyDraft = (id: string, draft: CardnewsDraft) => {
    const text = `${draft.headline}\n${draft.sub}\n\n${draft.slides.join('\n')}\n\n${draft.cta}`;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="mb-6 md:mb-8 pl-10 md:pl-0">
        <h1 className="text-xl font-bold text-gray-900">레퍼런스 리서치</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-1">경쟁사 광고를 검색하거나 직접 캡처해서 올리면, AI가 구조를 분석해 우리 브랜드용 카드뉴스 초안으로 재구성해드려요</p>
      </div>

      {/* 검색 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-bold text-gray-700 mb-2">Meta 광고 라이브러리에서 검색</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="예: 분양, 청약, 경쟁사 페이지명"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !keyword.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 text-white rounded-xl text-sm font-bold shrink-0"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {isSearching ? '검색 중...' : '검색'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">검색당 5~15초 정도 걸려요. 메타 쪽에서 일시적으로 접근이 막히면 잠시 후 다시 시도해주세요.</p>
        {searchError && (
          <div className="flex items-center gap-2 p-3 mt-2 bg-red-50 border border-red-100 rounded-xl">
            <span className="text-red-500 text-xs">{searchError}</span>
          </div>
        )}
      </div>

      {/* 직접 업로드 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
        <button onClick={() => setShowUpload(v => !v)} className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <Upload size={14} /> 직접 캡처해서 업로드하기
        </button>
        {showUpload && (
          <div className="mt-3 space-y-3">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
            <input
              type="text"
              value={uploadAdvertiser}
              onChange={e => setUploadAdvertiser(e.target.value)}
              placeholder="광고주/현장명 (선택)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
            />
            <textarea
              value={uploadText}
              onChange={e => setUploadText(e.target.value)}
              placeholder="광고 카피/설명을 옮겨 적어주세요"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
            />
            {uploadError && <p className="text-red-500 text-xs">{uploadError}</p>}
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-200 text-white rounded-xl text-sm font-bold"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {isUploading ? '업로드 중...' : '등록'}
            </button>
          </div>
        )}
      </div>

      {personas.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500">분석 기준 브랜드 페르소나</label>
          <select
            value={personaId}
            onChange={e => setPersonaId(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none bg-white"
          >
            <option value="">선택 안 함</option>
            {personas.map(p => (
              <option key={p.id} value={p.id}>{p.persona_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 결과 목록 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary-400" />
        </div>
      )}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Search size={36} className="text-gray-200 mb-3" />
          <p className="font-bold text-gray-500">저장된 레퍼런스가 없습니다</p>
          <p className="text-sm mt-1">위에서 검색하거나 직접 업로드해보세요</p>
        </div>
      )}

      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-1 rounded-full border ${item.source === 'search' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                  {item.source === 'search' ? `검색 · ${item.keyword}` : '직접 업로드'}
                </span>
                {item.advertiser_name && <span className="text-sm font-bold text-gray-800">{item.advertiser_name}</span>}
                {item.started_at && <span className="text-[11px] text-gray-400">{item.started_at}</span>}
              </div>
              {item.landing_domain && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
                  <ExternalLink size={11} /> {item.landing_domain}
                </span>
              )}
            </div>

            {item.media_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.media_url} alt={item.advertiser_name || '레퍼런스 이미지'} className="w-full max-h-64 object-contain rounded-xl bg-gray-50 mb-3" />
            )}

            {item.ad_text && (
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 mb-3 whitespace-pre-wrap">{item.ad_text}</p>
            )}

            {!item.ai_analysis ? (
              <button
                onClick={() => handleAnalyze(item.id)}
                disabled={analyzingId === item.id}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 text-white rounded-xl text-sm font-bold"
              >
                {analyzingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {analyzingId === item.id ? '분석 중...' : 'AI로 분석하기'}
              </button>
            ) : (
              <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-4 space-y-3">
                <div>
                  <span className="text-[11px] font-bold text-primary-600">핵심 메시지</span>
                  <p className="text-sm text-gray-800 mt-0.5">{item.ai_analysis.core_message}</p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-primary-600">사용된 구조</span>
                  <ul className="text-xs text-gray-600 mt-0.5 list-disc pl-4 space-y-0.5">
                    {item.ai_analysis.structure?.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-primary-600">후킹 요소</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {item.ai_analysis.hooks?.map((h, i) => (
                      <span key={i} className="text-[11px] bg-white border border-primary-100 text-primary-700 px-2 py-1 rounded-full">{h}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-gray-100">
                  <span className="text-[11px] font-bold text-gray-500">우리 브랜드용 카드뉴스 초안</span>
                  <p className="text-sm font-bold text-gray-900 mt-1">{item.ai_analysis.cardnews_draft?.headline}</p>
                  <p className="text-xs text-gray-500">{item.ai_analysis.cardnews_draft?.sub}</p>
                  <ul className="text-xs text-gray-600 mt-2 list-disc pl-4 space-y-0.5">
                    {item.ai_analysis.cardnews_draft?.slides?.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                  <p className="text-xs font-bold text-primary-600 mt-2">{item.ai_analysis.cardnews_draft?.cta}</p>
                  <button
                    onClick={() => handleCopyDraft(item.id, item.ai_analysis!.cardnews_draft)}
                    className={`flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${copiedId === item.id ? 'bg-green-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {copiedId === item.id ? <CheckCheck size={12} /> : <Copy size={12} />}
                    {copiedId === item.id ? '복사됨!' : '초안 복사'}
                  </button>
                  <p className="text-[10px] text-gray-400 mt-2">이 초안을 참고해서 카드뉴스 생성 페이지에서 직접 만들어보세요.</p>
                </div>
              </div>
            )}
            {analyzeError[item.id] && (
              <div className="flex items-center gap-2 p-2.5 mt-2 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-red-500 text-xs">{analyzeError[item.id]}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
