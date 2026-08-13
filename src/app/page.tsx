'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PenTool, Bot, FileText, CalendarDays,
  MessageSquare, TrendingUp, ChevronRight,
  Plus, Sparkles, Clock, RefreshCw, Palette, ArrowRight,
} from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { HybridThumb } from '@/components/cardnews/HybridThumb';

const QUICK_ACTIONS = [
  { href: '/cardnews', icon: <PenTool size={18} />, label: '카드뉴스', desc: 'AI 슬라이드 제작', color: 'from-violet-500 to-purple-600' },
  { href: '/blog-generator', icon: <FileText size={18} />, label: '블로그', desc: '네이버·티스토리', color: 'from-emerald-500 to-teal-500' },
  { href: '/social-post', icon: <TrendingUp size={18} />, label: '소셜 포스트', desc: '멀티플랫폼 캡션', color: 'from-orange-500 to-amber-500' },
  { href: '/auto-dm', icon: <Bot size={18} />, label: '자동 DM', desc: 'AI DM 작성', color: 'from-blue-500 to-cyan-500' },
  { href: '/comments', icon: <MessageSquare size={18} />, label: '댓글 템플릿', desc: 'SNS 답변 자동화', color: 'from-indigo-500 to-blue-600' },
  { href: '/brand-kit', icon: <Palette size={18} />, label: '브랜드 키트', desc: '색상·폰트 설정', color: 'from-rose-500 to-pink-500' },
];


function MiniCardPreview({ page }: { page: any }) {
  if (!page) return <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900" />;

  // 노트·신문 카드는 저장된 그림이 없다 — 글자를 그때그때 조판한다.
  // 이 갈래가 없어서 bgImage가 빈 채로 아래 어두운 갈래에 떨어졌고,
  // 최근 만든 카드가 전부 하이브리드라 '최근 작업'이 통째로 검은 타일이었다.
  // 보관함·편집기가 쓰는 미리보기를 그대로 쓴다.
  if (page.styleVariant === 'hybrid' || page.styleVariant === 'hybridPaper') {
    return <HybridThumb page={page} index={0} />;
  }

  // AI가 통째로 그린 카드(notebook)와 그림 카드(image)는 그림이 곧 카드다.
  // 어둡게 덮으면 글씨가 안 보이고, 잘라내면 가장자리가 날아간다.
  const isWholeImage = Boolean(page.bgImage)
    && (page.styleVariant === 'image' || page.styleVariant === 'notebook');
  if (isWholeImage) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#F3F1EA' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={page.bgImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} loading="lazy" />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {page.bgImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.bgImage.replace('w=800', 'w=200')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
      )}
      <div style={{ position: 'absolute', inset: 0, background: page.overlay || 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, textAlign: 'center' }}>
        {page.title && (
          <p style={{ color: page.titleStyle?.color || '#fff', fontSize: 9, fontWeight: 900, lineHeight: 1.3, textShadow: '0 1px 4px rgba(0,0,0,0.8)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', margin: 0 }}>
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
  const [userEmail, setUserEmail] = useState('');
  const [greeting, setGreeting] = useState('안녕하세요');
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [isBriefingSaved, setIsBriefingSaved] = useState(false);
  const [isSavingToBlog, setIsSavingToBlog] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('좋은 아침이에요');
    else if (h < 18) setGreeting('안녕하세요');
    else setGreeting('수고하셨어요');

    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email.split('@')[0]);
    });

    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
      setIsBriefingSaved(json.isBriefingSaved || false);
    } catch { /* ignore */ } finally {
      setIsLoading(false);
    }
  };

  const triggerBriefing = async () => {
    setIsGeneratingBriefing(true);
    try {
      const res = await fetch('/api/briefing');
      const json = await res.json();
      if (json.success) {
        fetchDashboard();
      } else {
        alert("브리핑 생성 실패: " + json.error);
      }
    } catch (err: any) {
      alert("에러가 발생했습니다: " + err.message);
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  // 크론(매일 08:30)을 기다리지 않고 지금 바로 뉴스 카드뉴스 초안 만들기
  const generateNewsDraft = async (force: boolean) => {
    setIsGeneratingDraft(true);
    try {
      const res = await fetch('/api/news-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert('초안 생성 실패: ' + (json.error || '알 수 없는 오류'));
        return;
      }
      if (json.skipped) {
        alert('오늘 브리핑으로 만든 초안이 이미 있어요. 새로 만들려면 "다시 만들기"를 눌러주세요.');
      }
      fetchDashboard();
    } catch (err: any) {
      alert('에러가 발생했습니다: ' + err.message);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const saveToBlog = async () => {
    if (!briefing || !briefing.id) return;
    setIsSavingToBlog(true);
    try {
      const res = await fetch('/api/briefing/to-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefingId: briefing.id })
      });
      const json = await res.json();
      
      if (json.success) {
        setIsBriefingSaved(true);
        if (json.skipped) {
          alert('이미 저장된 브리핑입니다');
        } else {
          alert('블로그에 저장되었습니다');
        }
      } else {
        alert("블로그 저장 실패: " + (json.error || "알 수 없는 오류"));
      }
    } catch (err: any) {
      alert("에러가 발생했습니다: " + err.message);
    } finally {
      setIsSavingToBlog(false);
    }
  };

  const stats = data?.stats ?? {};
  const recentDesigns: any[] = data?.recentDesigns ?? [];
  const upcomingPosts: any[] = data?.upcomingPosts ?? [];
  const briefing = data?.briefing;
  const newsDraft = data?.newsDraft;
  const todo = data?.todo ?? {};
  const topics: any[] = data?.topics ?? [];

  // 오늘 할 일 네 칸. 막혀 있는 것은 빨간 점으로 표시한다.
  const nextAt = todo.nextScheduledAt ? new Date(todo.nextScheduledAt) : null;
  const TODO_CARDS = [
    {
      icon: '📰',
      value: todo.hasDraft ? `${todo.draftSlides}장` : '없음',
      label: '오늘 아침 초안',
      hint: todo.hasDraft ? '확인하고 다듬기' : '아직 만들어지지 않았습니다',
      href: '/archive',
      urgent: !todo.hasDraft,
      tone: todo.hasDraft
        ? 'bg-amber-50 border-amber-100 focus:ring-amber-300'
        : 'bg-gray-50 border-gray-100 focus:ring-gray-300',
    },
    {
      icon: '📤',
      value: `${todo.unpublishedCount ?? 0}개`,
      label: '발행 안 한 카드뉴스',
      hint: todo.unpublishedCount ? '최근 2주에 만들고 안 올린 것' : '밀린 것이 없습니다',
      href: '/archive',
      urgent: (todo.unpublishedCount ?? 0) > 0,
      tone: (todo.unpublishedCount ?? 0) > 0
        ? 'bg-rose-50 border-rose-100 focus:ring-rose-300'
        : 'bg-emerald-50 border-emerald-100 focus:ring-emerald-300',
    },
    {
      icon: '📅',
      value: `${todo.pendingCount ?? 0}건`,
      label: '예약 발행 대기',
      hint: nextAt
        ? `다음 ${nextAt.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ${nextAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
        : '예약된 발행이 없습니다',
      href: '/calendar',
      urgent: false,
      tone: 'bg-blue-50 border-blue-100 focus:ring-blue-300',
    },
    {
      icon: '✍️',
      value: isBriefingSaved ? '완료' : '대기',
      label: '오늘 브리핑 → 블로그',
      hint: isBriefingSaved ? '블로그로 저장했습니다' : '아직 글로 옮기지 않았습니다',
      href: '/blog-generator',
      urgent: !isBriefingSaved && Boolean(briefing),
      tone: isBriefingSaved
        ? 'bg-emerald-50 border-emerald-100 focus:ring-emerald-300'
        : 'bg-violet-50 border-violet-100 focus:ring-violet-300',
    },
  ];
  // 오늘 아침 뉴스로 만들어진 초안인지 (KST 기준 24시간 이내)
  const isFreshDraft = newsDraft?.created_at
    ? Date.now() - new Date(newsDraft.created_at).getTime() < 36 * 60 * 60 * 1000
    : false;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-7 pb-20 md:pb-8">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 md:p-8 text-white shadow-lg">
        <div className="relative z-10">
          <p className="text-sm font-medium text-violet-200 mb-1">
            {greeting}{userEmail ? `, ${userEmail}님` : ''} 👋
          </p>
          <h1 className="text-2xl md:text-3xl font-black mb-4 leading-tight">
            오늘 어떤 콘텐츠를<br className="hidden md:block" /> 만들어볼까요?
          </h1>
          <Link
            href="/cardnews"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-violet-700 font-bold text-sm rounded-2xl hover:bg-violet-50 active:scale-[0.98] transition-all shadow-sm"
          >
            <Sparkles size={16} /> AI 카드뉴스 만들기 <ArrowRight size={14} />
          </Link>
        </div>
        {/* 배경 장식 */}
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -right-4 bottom-0 w-24 h-24 rounded-full bg-white/10" />
      </div>

      {/* ── 오늘의 뉴스 카드뉴스 초안 (자동 생성, 발행은 사람이) ─────────────── */}
      {!isLoading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 md:p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5">📰</span>
            <div className="flex-1 min-w-0">
              {isFreshDraft && newsDraft ? (
                <>
                  <p className="text-sm font-bold text-amber-900 mb-0.5">
                    오늘 아침 뉴스로 카드뉴스 초안을 만들어 뒀어요
                  </p>
                  <p className="text-[12px] text-amber-800/80 leading-relaxed mb-3 break-words">
                    {newsDraft.name}
                    {Array.isArray(newsDraft.pages_data) && ` · ${newsDraft.pages_data.length}장`}
                    {' · 자동 발행되지 않습니다. 내용을 확인하고 직접 발행해주세요.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/cardnews/editor?id=${newsDraft.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-300 active:scale-[0.98] transition-colors"
                    >
                      확인하고 다듬기 <ArrowRight size={13} />
                    </Link>
                    <button
                      onClick={() => generateNewsDraft(true)}
                      disabled={isGeneratingDraft}
                      className="inline-flex items-center px-4 py-2 bg-white border border-amber-200 text-amber-800 text-xs font-bold rounded-xl hover:bg-amber-100/60 focus:outline-none focus:ring-2 focus:ring-amber-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isGeneratingDraft ? '만드는 중...' : '다시 만들기'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-amber-900 mb-0.5">
                    오늘의 뉴스 카드뉴스 초안
                  </p>
                  <p className="text-[12px] text-amber-800/80 leading-relaxed mb-3">
                    매일 아침 8시 30분에 그날 부동산 뉴스로 초안을 만들어 둡니다.
                    자동 발행되지 않고, 확인 후 직접 발행하시면 됩니다.
                  </p>
                  <button
                    onClick={() => generateNewsDraft(false)}
                    disabled={isGeneratingDraft}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGeneratingDraft ? '만드는 중...' : '지금 만들기'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 오늘 할 일 ─────────────────────────────────────────────────────
          예전에는 '저장된 디자인 81 / 댓글 템플릿 67' 같은 누적 숫자를 띄웠다.
          계속 쌓이기만 하는 값이라 매일 봐도 무엇을 해야 하는지 알 수 없었다.
          하루 흐름(아침 초안 → 다듬기 → 발행 → 블로그·영상)에서 막힌 것만 센다. */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">오늘 할 일</h2>
          {!isLoading && (
            <span className="text-[11px] text-gray-400">
              누적 {stats.totalDesigns ?? 0}개 · 이번 주 {stats.weeklyCreated ?? 0}개
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading
            ? [...Array(4)].map((_, i) => <div key={i} className="h-[104px] bg-gray-100 rounded-2xl animate-pulse" />)
            : TODO_CARDS.map(c => (
              <Link
                key={c.label}
                href={c.href}
                className={`relative flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-1 ${c.tone}`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-lg leading-none">{c.icon}</span>
                  {c.urgent && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden />
                  )}
                </div>
                <div>
                  <div className="text-[19px] font-black text-gray-900 leading-tight">{c.value}</div>
                  <div className="text-[11px] font-bold text-gray-600 mt-0.5">{c.label}</div>
                  <div className="text-[10px] text-gray-400 mt-1 leading-tight">{c.hint}</div>
                </div>
              </Link>
            ))}
        </div>
      </div>

      {/* ── 오늘의 소재 ────────────────────────────────────────────────────
          예전에는 'AI 업무 자동화', '건강한 식습관' 같은 고정 문자열 6개였다.
          부동산 계정에 아무 상관 없는 키워드라 누를 이유가 없었다.
          오늘 아침 브리핑이 실제로 모아 온 기사 제목을 그대로 쓴다. */}
      {topics.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-primary-500" />
              <h2 className="text-sm font-bold text-gray-900">오늘의 소재</h2>
              <span className="text-[10px] text-gray-400">오늘 아침 수집한 뉴스 {topics.length}건</span>
            </div>
            <Link href="/cardnews" className="text-[11px] text-primary-600 hover:text-primary-700 font-bold">
              직접 입력 →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {topics.map((t: any, i: number) => (
              <Link
                key={i}
                href={`/cardnews?trend=${encodeURIComponent(t.title)}`}
                title={t.title}
                className="max-w-full truncate text-[12px] px-3 py-1.5 bg-gray-50 hover:bg-primary-50 hover:text-primary-700 border border-gray-100 hover:border-primary-200 text-gray-700 rounded-full transition-colors font-medium"
              >
                {t.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 빠른 시작 ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">빠른 시작</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
          {QUICK_ACTIONS.map(a => (
            <Link key={a.href} href={a.href}
              className="flex flex-col items-center gap-2 p-3.5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}>
                {a.icon}
              </div>
              <div className="text-center">
                <p className="text-[11px] font-bold text-gray-800">{a.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight hidden md:block">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 메인 그리드 ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

        {/* ── 오늘의 브리핑 (전체 폭) ────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-5 md:p-6 shadow-sm h-[200px] animate-pulse flex flex-col justify-between">
              <div className="h-6 w-1/3 bg-gray-200 rounded" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-200 rounded" />
                <div className="h-4 w-5/6 bg-gray-200 rounded" />
              </div>
            </div>
          ) : briefing ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">오늘의 일일 브리핑</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      브리핑 날짜: {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(briefing.created_at))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-100">
                    {/* briefing.date는 뉴스를 모은 '오늘'이다. 광고 지표는 수치가 확정된
                        '어제' 기준이라 ad_performance.date를 봐야 한다 */}
                    광고 성과 기준일: {briefing.ad_performance?.date || briefing.date}
                  </span>
                  <button 
                    onClick={saveToBlog} 
                    disabled={isSavingToBlog || isBriefingSaved}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 text-[10px] font-semibold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                  >
                    {isSavingToBlog ? <RefreshCw size={10} className="animate-spin" /> : <FileText size={10} />}
                    {isBriefingSaved ? "저장됨 ✓" : "블로그로 저장"}
                  </button>
                  <button 
                    onClick={triggerBriefing} 
                    disabled={isGeneratingBriefing}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-600 disabled:opacity-50 text-[10px] font-semibold rounded-lg border border-gray-200 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={10} className={isGeneratingBriefing ? 'animate-spin' : ''} />
                    수동 갱신
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 종합 브리핑 전문 */}
                <div className="space-y-2 lg:col-span-2">
                  <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">📝 종합 브리핑 전문</h4>
                  <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                    {briefing.full_report || briefing.real_estate_summary}
                  </div>
                </div>

                {/* 광고 성과 리포트 */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">📢 소셜 광고 성과 (Meta Ads)</h4>
                  {/* 연동 전에는 숫자를 보여주지 않는다. 예전에는 고정 더미값을 띄워서
                      실제로는 지출이 0원인데 매일 광고비를 쓴 것처럼 보였다. */}
                  {briefing.ad_performance && briefing.ad_performance.connected === false ? (
                    <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5">
                      <p className="text-[11px] font-bold text-amber-900 mb-1">광고 계정이 아직 연동되지 않았습니다</p>
                      <p className="text-[10px] text-amber-800/80 leading-relaxed">
                        {briefing.ad_performance.reason || '연동 정보를 확인해주세요.'}
                        <br />
                        연동 전까지는 광고 수치를 표시하지 않습니다.
                      </p>
                    </div>
                  ) : (
                  <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50/40 border border-blue-100/50 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-blue-500 leading-none mb-1">지출액</p>
                      <p className="text-xs font-black text-gray-950">{(briefing.ad_performance?.spend ?? 0).toLocaleString()}원</p>
                    </div>
                    <div className="bg-emerald-50/40 border border-emerald-100/50 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-emerald-500 leading-none mb-1">획득 리드</p>
                      <p className="text-xs font-black text-gray-950">{(briefing.ad_performance?.leads ?? 0).toLocaleString()}건</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">CPL: {(briefing.ad_performance?.cpl ?? 0).toLocaleString()}원</p>
                    </div>
                    <div className="bg-violet-50/40 border border-violet-100/50 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-violet-500 leading-none mb-1">노출수</p>
                      <p className="text-xs font-black text-gray-950">{(briefing.ad_performance?.impressions ?? 0).toLocaleString()}회</p>
                    </div>
                    <div className="bg-amber-50/40 border border-amber-100/50 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-amber-500 leading-none mb-1">클릭수</p>
                      <p className="text-xs font-black text-gray-950">{(briefing.ad_performance?.clicks ?? 0).toLocaleString()}회</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">CTR: {((briefing.ad_performance?.ctr ?? 0) * 100).toFixed(2)}%</p>
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-400 italic text-right mt-1">
                    ※ {briefing.ad_performance?.date ? `${briefing.ad_performance.date} 실집행 기준` : '집계 기준일 미상'}
                  </p>
                  </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xl shadow-sm shrink-0">
                  📊
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-800">오늘 브리핑이 아직 없습니다</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">매일 오전 8시(KST)에 자동으로 생성되거나, 지금 수동으로 생성할 수 있습니다.</p>
                </div>
              </div>
              <button
                onClick={triggerBriefing}
                disabled={isGeneratingBriefing}
                className="self-start sm:self-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] transition-all text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
              >
                <RefreshCw size={12} className={isGeneratingBriefing ? 'animate-spin' : ''} />
                지금 브리핑 생성하기
              </button>
            </div>
          )}
        </div>

        {/* 최근 디자인 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">최근 작업</h2>
            <div className="flex items-center gap-2">
              <button onClick={fetchDashboard} disabled={isLoading} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40">
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              </button>
              <Link href="/cardnews?tab=history" className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-semibold">
                전체 보기 <ChevronRight size={13} />
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="bg-gray-100 rounded-2xl h-32 animate-pulse" />)}
            </div>
          ) : recentDesigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 bg-white border-2 border-dashed border-gray-100 rounded-2xl text-gray-400">
              <div className="text-4xl mb-3">🎨</div>
              <p className="text-sm font-semibold text-gray-500">아직 저장된 디자인이 없어요</p>
              <p className="text-xs mt-1 text-gray-400">첫 번째 카드뉴스를 만들어보세요</p>
              <Link href="/cardnews" className="mt-4 px-5 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 transition-colors">
                카드뉴스 만들기
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {recentDesigns.slice(0, 5).map(design => {
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
                      // id를 같이 넘겨야 편집기가 '이 디자인을 고치는 중'으로 안다.
                      // 빠뜨리면 저장할 때 원본을 덮지 않고 새 디자인이 하나 더 생기고,
                      // 캡션도 이 카드뉴스와 이어지지 않는다.
                      // (보관함·카드뉴스 목록은 원래 둘 다 넘기고 있었다)
                      localStorage.setItem('editingDesignId', String(design.id));
                      localStorage.removeItem('cardNewsData');
                      window.location.href = '/cardnews/editor';
                    }}
                  >
                    <div className="relative overflow-hidden" style={{ height: 110 }}>
                      <MiniCardPreview page={firstPage} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{slideCount}장</div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-white/90 text-gray-900 text-[11px] font-bold px-3 py-1.5 rounded-full shadow">편집하기</span>
                      </div>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-xs font-bold text-gray-800 truncate">{design.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{createdAt}</p>
                    </div>
                  </div>
                );
              })}

              {/* 새 카드뉴스 */}
              <Link href="/cardnews"
                className="flex flex-col items-center justify-center bg-white border-2 border-dashed border-gray-200 rounded-2xl hover:border-primary-400 hover:bg-primary-50/50 transition-all group"
                style={{ minHeight: 140 }}
              >
                <div className="w-9 h-9 rounded-xl bg-gray-100 group-hover:bg-primary-100 flex items-center justify-center text-gray-400 group-hover:text-primary-600 transition-colors mb-2">
                  <Plus size={18} />
                </div>
                <p className="text-[11px] font-bold text-gray-400 group-hover:text-primary-600 transition-colors">새 카드뉴스</p>
              </Link>
            </div>
          )}
        </div>

        {/* 우측 패널 */}
        <div className="space-y-4">

          {/* 밀린 카드뉴스 — 만들어 놓고 안 올린 것부터 처리하도록 이름을 보여준다 */}
          {(todo.unpublished?.length ?? 0) > 0 && (
            <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-4 text-white shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock size={13} />
                <span className="text-xs font-bold">아직 안 올린 카드뉴스 {todo.unpublishedCount}개</span>
              </div>
              <div className="space-y-1 mb-3">
                {todo.unpublished.map((d: any) => (
                  <p key={d.id} className="text-[11px] text-white/90 truncate">· {d.name}</p>
                ))}
              </div>
              <Link
                href="/archive"
                className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-white text-rose-600 font-bold text-xs rounded-xl hover:bg-rose-50 transition-colors"
              >
                <ArrowRight size={12} /> 보관함에서 발행하기
              </Link>
            </div>
          )}

          {/* 예약 발행 */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays size={14} className="text-blue-500" />
                <h3 className="text-sm font-bold text-gray-800">예약 발행</h3>
              </div>
              <Link href="/cardnews" className="text-[11px] text-primary-600 hover:underline font-semibold">관리 →</Link>
            </div>
            {isLoading ? (
              <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : upcomingPosts.length === 0 ? (
              <div className="text-center py-5 text-gray-400">
                <p className="text-xs">예약된 발행이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingPosts.slice(0, 3).map(post => {
                  const d = new Date(post.scheduled_at);
                  const isOverdue = d < new Date();
                  return (
                    <div key={post.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${isOverdue ? 'border-orange-100 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="w-8 h-10 rounded-lg overflow-hidden bg-gray-200 shrink-0">
                        {post.thumbnail_url
                          ? <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-sm">🖼️</div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-gray-700 truncate">{post.design_name || '카드뉴스'}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock size={8} className={isOverdue ? 'text-orange-500' : 'text-gray-400'} />
                          <span className={`text-[9px] font-medium ${isOverdue ? 'text-orange-600' : 'text-gray-400'}`}>
                            {d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} {d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 운영 관리 바로가기 */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">관리</h3>
            <div className="space-y-0.5">
              {[
                { href: '/persona', icon: '🎭', label: '브랜드 페르소나' },
                { href: '/sns-settings', icon: '🔗', label: 'SNS 계정 연동' },
                { href: '/cardnews?tab=analytics', icon: '📊', label: '성과 분석' },
                { href: '/comments', icon: '💬', label: '댓글 템플릿' },
              ].map(item => (
                <Link key={item.label} href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors group">
                  <span className="text-base">{item.icon}</span>
                  <span className="text-xs font-semibold">{item.label}</span>
                  <ChevronRight size={11} className="ml-auto text-gray-300 group-hover:text-gray-400" />
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
