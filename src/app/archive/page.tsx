'use client';

import { useState, useEffect } from 'react';
import { FileText, Loader2, Calendar, Hash, FolderOpen, Archive, Layout, Trash2, X, ChevronLeft, ChevronRight, Pencil, ImageOff } from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  body?: string;
  meta_description?: string;
  tags?: string[];
  topic?: string;
  format?: string;
  created_at: string;
  updated_at: string;
}

interface CardDesign {
  id: string;
  name: string;
  description?: string;
  pages_data: any[];
  created_at: string;
}

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState<'blog' | 'cardnews'>('blog');
  const [preview, setPreview] = useState<CardDesign | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [designs, setDesigns] = useState<CardDesign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDesignsLoading, setIsDesignsLoading] = useState(true);
  const [error, setError] = useState('');
  const [designsError, setDesignsError] = useState('');

  const fetchPosts = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/blog-posts');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPosts(data.posts || []);
    } catch (e: any) {
      console.error('Failed to fetch blog posts:', e);
      setError('블로그 글 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDesigns = async () => {
    setIsDesignsLoading(true);
    setDesignsError('');
    try {
      const res = await fetch('/api/designs');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDesigns(data.designs || []);
    } catch (e: any) {
      console.error('Failed to fetch designs:', e);
      setDesignsError('카드뉴스 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsDesignsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'blog') {
      fetchPosts();
    } else if (activeTab === 'cardnews') {
      fetchDesigns();
    }
  }, [activeTab]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  const getFormatBadge = (formatStr: string | undefined) => {
    switch (formatStr) {
      case 'naver':
        return { label: '네이버 블로그', icon: '🟢', color: 'bg-green-50 text-green-700 border-green-200' };
      case 'tistory':
        return { label: '티스토리 / WP', icon: '🔵', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'instagram':
        return { label: '인스타 캡처용', icon: '🟣', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      default:
        return { label: '기타 블로그', icon: '📝', color: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  };

  const handleCardClick = (id: string) => {
    window.location.href = `/blog-generator?postId=${id}`;
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/blog-posts/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPosts((prev) => prev.filter((post) => post.id !== id));
    } catch (e: any) {
      console.error('Failed to delete blog post:', e);
      alert('삭제에 실패했습니다: ' + e.message);
    }
  };

  const handleCardNewsClick = (design: CardDesign) => {
    localStorage.setItem('editingDesign', JSON.stringify(design.pages_data));
    localStorage.setItem('editingDesignId', String(design.id));
    localStorage.removeItem('cardNewsData');
    window.location.href = `/cardnews/editor?id=${design.id}`;
  };

  // 카드 한 장의 그림 주소. 손글씨 노트는 그림 한 장이 카드 전체라
  // 이것만으로 미리보기가 된다. 사진 스타일은 배경만 나오므로 제목을 얹어 보여준다.
  const pageImage = (page: any): string => page?.bgImage || '';
  const pageTitle = (page: any): string =>
    page?.title || page?.blocks?.find((b: any) => b.type === 'headline')?.text || '';

  const openPreview = (design: CardDesign) => {
    setPreview(design);
    setPreviewPage(0);
  };

  // 미리보기가 열려 있을 때 좌우 화살표로 넘긴다
  useEffect(() => {
    if (!preview) return;
    const total = preview.pages_data?.length || 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null);
      if (e.key === 'ArrowRight') setPreviewPage(p => Math.min(p + 1, total - 1));
      if (e.key === 'ArrowLeft') setPreviewPage(p => Math.max(p - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  return (
    <div className="flex flex-col h-full bg-gray-50 w-full overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-5 shrink-0">
        <h1 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2 ml-10 md:ml-0">
          <Archive size={20} className="text-primary-500" /> 내 콘텐츠 보관함
        </h1>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5 ml-10 md:ml-0">
          AI로 생성하고 저장한 블로그 글과 카드뉴스를 관리합니다
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 shrink-0 flex">
        <button
          onClick={() => setActiveTab('blog')}
          className={`flex items-center gap-2 px-5 py-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'blog'
              ? 'border-primary-500 text-primary-600 font-extrabold'
              : 'border-transparent text-gray-400 hover:text-gray-600 font-medium'
          }`}
        >
          <FileText size={16} />
          <span>내 블로그 글 ({posts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('cardnews')}
          className={`flex items-center gap-2 px-5 py-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'cardnews'
              ? 'border-primary-500 text-primary-600 font-extrabold'
              : 'border-transparent text-gray-400 hover:text-gray-600 font-medium'
          }`}
        >
          <Layout size={16} />
          <span>내 카드뉴스 ({designs.length})</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {activeTab === 'blog' ? (
          <>
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
                <Loader2 size={32} className="animate-spin text-primary-500" />
                <p className="text-sm font-semibold">저장된 블로그 글을 불러오고 있습니다...</p>
              </div>
            )}

            {error && (
              <div className="max-w-md mx-auto my-12 bg-red-50 border border-red-200 rounded-2xl p-5 text-center text-red-600">
                <p className="font-bold mb-1">불러오기 실패</p>
                <p className="text-xs">{error}</p>
              </div>
            )}

            {!isLoading && !error && posts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400 gap-3">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <FolderOpen size={28} className="text-gray-300" />
                </div>
                <div>
                  <p className="font-bold text-gray-500 text-sm">보관함이 비어 있습니다</p>
                  <p className="text-xs mt-1">블로그 생성기에서 생성한 글을 저장해 보세요</p>
                </div>
              </div>
            )}

            {!isLoading && !error && posts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                {posts.map((post) => {
                  const badge = getFormatBadge(post.format);
                  return (
                    <div
                      key={post.id}
                      onClick={() => handleCardClick(post.id)}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-300 transition-all p-5 flex flex-col justify-between cursor-pointer group relative"
                    >
                      <div className="space-y-3">
                        {/* Header Badge & Date */}
                        <div className="flex items-center justify-between pr-8">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.color}`}>
                            {badge.icon} {badge.label}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                            <Calendar size={11} /> {formatDate(post.created_at)}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-gray-800 text-sm md:text-base leading-snug group-hover:text-primary-600 transition-colors line-clamp-2 pr-6">
                          {post.title}
                        </h3>

                        {/* Topic */}
                        {post.topic && (
                          <p className="text-[12px] text-gray-400 font-medium line-clamp-1">
                            주제: {post.topic}
                          </p>
                        )}
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePost(post.id);
                        }}
                        title="삭제"
                        className="absolute top-4 right-4 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10"
                      >
                        <Trash2 size={15} />
                      </button>

                      {/* Tags */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-gray-50">
                          {post.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                            >
                              <Hash size={9} />
                              {tag}
                            </span>
                          ))}
                          {post.tags.length > 3 && (
                            <span className="text-[9px] text-gray-400 font-bold self-center">
                              +{post.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* 내 카드뉴스 탭 */
          <>
            {isDesignsLoading && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
                <Loader2 size={32} className="animate-spin text-primary-500" />
                <p className="text-sm font-semibold">저장된 카드뉴스를 불러오고 있습니다...</p>
              </div>
            )}

            {designsError && (
              <div className="max-w-md mx-auto my-12 bg-red-50 border border-red-200 rounded-2xl p-5 text-center text-red-600">
                <p className="font-bold mb-1">불러오기 실패</p>
                <p className="text-xs">{designsError}</p>
              </div>
            )}

            {!isDesignsLoading && !designsError && designs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400 gap-3">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <Layout size={28} className="text-gray-300" />
                </div>
                <div>
                  <p className="font-bold text-gray-500 text-sm">보관함이 비어 있습니다</p>
                  <p className="text-xs mt-1">카드뉴스 에디터에서 생성한 카드뉴스를 저장해 보세요</p>
                </div>
              </div>
            )}

            {!isDesignsLoading && !designsError && designs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                {designs.map((design) => {
                  const pagesCount = design.pages_data?.length || 0;
                  const cover = design.pages_data?.[0];
                  const coverImage = pageImage(cover);
                  return (
                    <div
                      key={design.id}
                      onClick={() => openPreview(design)}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-300 transition-all overflow-hidden flex flex-col cursor-pointer group"
                    >
                      {/* 표지 미리보기 */}
                      <div className="relative bg-gray-100 aspect-[4/5] overflow-hidden">
                        {coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={coverImage}
                            alt={`${design.name} 표지`}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300 px-4 text-center">
                            <ImageOff size={22} />
                            <span className="text-[11px] font-semibold text-gray-400 line-clamp-3">
                              {pageTitle(cover) || '그림 없음'}
                            </span>
                          </div>
                        )}
                        <span className="absolute bottom-2 right-2 text-[10px] font-bold text-white bg-black/55 px-2 py-0.5 rounded-full">
                          {pagesCount}장
                        </span>
                      </div>

                      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                            🖼️ 카드뉴스
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                            <Calendar size={11} /> {formatDate(design.created_at)}
                          </span>
                        </div>

                        <h3 className="font-bold text-gray-800 text-sm md:text-base leading-snug group-hover:text-primary-600 transition-colors line-clamp-2">
                          {design.name}
                        </h3>

                        {design.description && (
                          <p className="text-[12px] text-gray-400 font-medium line-clamp-1">
                            설명: {design.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50 text-xs text-gray-500 font-semibold">
                        <span>슬라이드 개수: {pagesCount}장</span>
                        <button
                          onClick={e => { e.stopPropagation(); handleCardNewsClick(design); }}
                          className="flex items-center gap-1 text-primary-600 hover:text-primary-700 focus:outline-none focus:underline font-bold"
                        >
                          <Pencil size={12} /> 편집
                        </button>
                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* 미리보기 — 저장된 장을 그대로 넘겨본다 */}
      {preview && (() => {
        const pages = preview.pages_data || [];
        const total = pages.length;
        const page = pages[previewPage];
        const img = pageImage(page);
        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreview(null)}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-[480px] max-h-full overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <h3 className="flex-1 text-sm font-bold text-gray-900 truncate">{preview.name}</h3>
                <button
                  onClick={() => setPreview(null)}
                  aria-label="닫기"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="relative bg-gray-900 flex items-center justify-center" style={{ aspectRatio: '4 / 5' }}>
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={`${previewPage + 1}번째 장`} className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="text-center px-8">
                    <p className="text-white text-base font-bold leading-snug">{pageTitle(page) || '내용 없음'}</p>
                    <p className="text-gray-400 text-[11px] mt-2">이 장에는 저장된 그림이 없습니다</p>
                  </div>
                )}

                {previewPage > 0 && (
                  <button
                    onClick={() => setPreviewPage(p => p - 1)}
                    aria-label="이전 장"
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/50 active:scale-95 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                {previewPage < total - 1 && (
                  <button
                    onClick={() => setPreviewPage(p => p + 1)}
                    aria-label="다음 장"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/50 active:scale-95 transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                )}
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white bg-black/55 px-2.5 py-1 rounded-full">
                  {previewPage + 1} / {total}
                </span>
              </div>

              {/* 장 넘기기 썸네일 */}
              {total > 1 && (
                <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 border-t border-gray-100">
                  {pages.map((p: any, i: number) => {
                    const t = pageImage(p);
                    return (
                      <button
                        key={i}
                        onClick={() => setPreviewPage(i)}
                        aria-label={`${i + 1}번째 장 보기`}
                        className={`shrink-0 w-10 rounded-md overflow-hidden border-2 bg-gray-100 focus:outline-none transition-colors ${
                          i === previewPage ? 'border-primary-500' : 'border-transparent hover:border-gray-300'
                        }`}
                        style={{ aspectRatio: '4 / 5' }}
                      >
                        {t ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t} alt="" loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-gray-400 font-bold">{i + 1}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="px-4 py-3 border-t border-gray-100">
                <button
                  onClick={() => handleCardNewsClick(preview)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300 active:scale-[0.99] transition-colors"
                >
                  <Pencil size={14} /> 편집기에서 열기
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
