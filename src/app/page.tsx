'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PenTool, Film, Bot, FileText, BarChart2, CalendarDays,
  MessageSquare, Users, TrendingUp, ChevronRight,
  Plus, Sparkles, Clock, RefreshCw,
} from 'lucide-react';

const QUICK_ACTIONS = [
  { href: '/cardnews', icon: <PenTool size={20} />, label: '카드뉴스 생성', desc: 'AI로 슬라이드 제작', color: 'from-violet-500 to-purple-600' },
  { href: '/video-generator', icon: <Film size={20} />, label: '영상 생성', desc: '카드뉴스 → 릴스 영상', color: 'from-pink-500 to-rose-500' },
  { href: '/auto-dm', icon: <Bot size={20} />, label: '자동 DM', desc: 'AI DM 3가지 버전', color: 'from-blue-500 to-cyan-500' },
  { href: '/blog-generator', icon: <FileText size={20} />, label: '블로그 생성', desc: '네이버·티스토리 최적화', color: 'from-emerald-500 to-teal-500' },
  { href: '/social-post', icon: <TrendingUp size={20} />, label: '소셜 포스트', desc: '멀티플랫폼 캡션', color: 'from-orange-500 to-amber-500' },
  { href: '/comments', icon: <MessageSquare size={20} />, label: '댓글 템플릿', desc: 'SNS 답변 자동화', color: 'from-indigo-500 to-blue-600' },
];

const TREND_KEYWORDS = ['2026 부동산 전망', 'AI 업무 자동화', '퍼스널 브랜딩', 'MZ 소비 트렌드', '건강한 식습관', '인스타 알고리즘'];

function MiniCardPreview({ page }: { page: any }) {
  if (!page) return <div className="w-full h-full bg-gray-800" />;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {page.bgImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.bgImage.replace('w=800', 'w=200')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
      )}
      <div style={{ position: 'absolute', inset: 0, background: page.overlay || 'rgba(0,0,0,0.45)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, textAlign: 'center' }}>
        {page.title && (
          <p style={{ color: page.titleStyle?.color || '#fff', fontSize: 9, fontWeight: 900, lineHeight: 1.3, textShadow: '0 1px 4px rgba(0,0,0,0.7)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', margin: 0 }}>
            {page.title}
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trendIdx, setTrendIdx] = useState(0);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
    } catch { /* ignore */ } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const stats = data?.stats ?? {};
  const recentDesigns: any[] = data?.recentDesigns ?? [];
  const upcomingPosts: any[] = data?.upcomingPosts ?? [];

  const statCards = [
    { label: '저장된 디자인', value: stats.totalDesigns ?? 0, icon: <PenTool size={16} />, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: '이번 주 생성', value: stats.weeklyCreated ?? 0, icon: <Sparkles size={16} />, color: 'text-pink-600', bg: 'bg-pink-50' },
    { label: '예약 발행 대기', value: stats.pendingPosts ?? 0, icon: <CalendarDays size={16} />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '댓글 템플릿', value: stats.commentTemplates ?? 0, icon: <MessageSquare size={16} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="ml-10 md:ml-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">AI 콘텐츠 제작 현황을 한눈에 확인하세요</p>
        </div>
        <button onClick={fetchDashboard} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className={`w-9 h-9 ${s.bg} ${s.color} rounded-xl flex items-center justify-center mb-3`}>{s.icon}</div>
            {isLoading ? (
              <div className="h-8 w-12 bg-gray-100 rounded animate-pulse mb-1" />
            ) : (
              <div className="text-2xl font-bold text-gray-900 mb-0.5">{s.value.toLocaleString()}</div>
            )}
            <div className="text-xs text-gray-500 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-4">빠른 시작</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
          {QUICK_ACTIONS.map(a => (
            <Link key={a.href} href={a.href}
              className="flex flex-col items-center gap-2.5 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}>
                {a.icon}
              </div>
              <div className="text-center">
                <p className="text-[12px] font-bold text-gray-800">{a.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* Left: 최근 디자인 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800">최근 디자인</h2>
            <Link href="/cardnews" className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-semibold">
              전체 보기 <ChevronRight size={13} />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-2xl h-36 md:h-44 animate-pulse" />
              ))}
            </div>
          ) : recentDesigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-gray-100 rounded-2xl text-gray-400">
              <PenTool size={32} className="mb-3 text-gray-200" />
              <p className="text-sm font-semibold">아직 저장된 디자인이 없습니다</p>
              <p className="text-xs mt-1">카드뉴스를 만들고 저장해보세요</p>
              <Link href="/cardnews" className="mt-4 px-5 py-2 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 transition-colors">
                카드뉴스 만들기
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
              {recentDesigns.map(design => {
                const firstPage = design.pages_data?.[0];
                const slideCount = design.pages_data?.length ?? 0;
                const createdAt = design.created_at
                  ? new Date(design.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                  : '';
                return (
                  <div
                    key={design.id}
                    className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer"
                    onClick={() => {
                      localStorage.setItem('editingDesign', JSON.stringify(design.pages_data));
                      localStorage.removeItem('cardNewsData');
                      window.location.href = '/cardnews/editor';
                    }}
                  >
                    <div className="relative bg-gray-900 overflow-hidden" style={{ height: 120 }}>
                      <MiniCardPreview page={firstPage} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{slideCount}장</div>
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-bold text-gray-800 truncate">{design.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{createdAt}</p>
                    </div>
                  </div>
                );
              })}

              {/* New Design Card */}
              <Link href="/cardnews"
                className="flex flex-col items-center justify-center bg-white border-2 border-dashed border-gray-200 rounded-2xl hover:border-primary-400 hover:bg-primary-50 transition-all group"
                style={{ minHeight: 152 }}
              >
                <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-primary-100 flex items-center justify-center text-gray-400 group-hover:text-primary-600 transition-colors mb-2">
                  <Plus size={20} />
                </div>
                <p className="text-xs font-bold text-gray-400 group-hover:text-primary-600 transition-colors">새 카드뉴스</p>
              </Link>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-5">

          {/* 트렌드 키워드로 빠른 생성 */}
          <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-5 text-white shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={15} />
              <span className="text-sm font-bold">트렌드 키워드로 바로 생성</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {TREND_KEYWORDS.map((kw, i) => (
                <button
                  key={kw}
                  onClick={() => setTrendIdx(i)}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all ${trendIdx === i ? 'bg-white text-violet-700' : 'bg-white/20 text-white hover:bg-white/30'}`}
                >
                  {kw}
                </button>
              ))}
            </div>
            <Link
              href={`/cardnews?trend=${encodeURIComponent(TREND_KEYWORDS[trendIdx])}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-white text-violet-700 font-bold text-sm rounded-xl hover:bg-violet-50 transition-colors"
            >
              <Sparkles size={14} /> 카드뉴스 만들기
            </Link>
          </div>

          {/* 예약 발행 현황 */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays size={15} className="text-blue-500" />
                <h3 className="text-sm font-bold text-gray-800">예약 발행</h3>
              </div>
              <Link href="/cardnews" className="text-[11px] text-primary-600 hover:underline font-semibold">관리 →</Link>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : upcomingPosts.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <CalendarDays size={24} className="mx-auto mb-2 text-gray-200" />
                <p className="text-xs">예약된 발행이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingPosts.map(post => {
                  const d = new Date(post.scheduled_at);
                  const isOverdue = d < new Date();
                  return (
                    <div key={post.id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${isOverdue ? 'border-orange-100 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="w-10 h-12 rounded-lg overflow-hidden bg-gray-200 shrink-0">
                        {post.thumbnail_url
                          ? <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-lg">🖼️</div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-gray-700 truncate">{post.design_name || '카드뉴스'}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock size={9} className={isOverdue ? 'text-orange-500' : 'text-gray-400'} />
                          <span className={`text-[10px] font-medium ${isOverdue ? 'text-orange-600' : 'text-gray-400'}`}>
                            {d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} {d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isOverdue ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                        {isOverdue ? '대기' : '예약'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 바로가기 */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 mb-3">운영 관리</h3>
            <div className="space-y-1">
              {[
                { href: '/persona', icon: <Users size={14} />, label: '브랜드 페르소나' },
                { href: '/cardnews', icon: <BarChart2 size={14} />, label: '성과 대시보드', hash: '#analytics' },
                { href: '/workspace', icon: <Users size={14} />, label: '팀 워크스페이스' },
                { href: '/comments', icon: <MessageSquare size={14} />, label: '댓글 템플릿' },
              ].map(item => (
                <Link key={item.label} href={item.href + (item.hash || '')}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors group">
                  <span className="text-gray-400 group-hover:text-primary-600 transition-colors">{item.icon}</span>
                  {item.label}
                  <ChevronRight size={12} className="ml-auto text-gray-300 group-hover:text-gray-400" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
