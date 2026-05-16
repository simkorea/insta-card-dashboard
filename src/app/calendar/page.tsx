'use client';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, Share2, Loader2, X } from 'lucide-react';
import Link from 'next/link';

interface ScheduledPost {
  id: string;
  title: string;
  platform: string;
  scheduled_at: string;
  status: string;
  caption?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700 border-pink-200',
  threads: 'bg-gray-100 text-gray-700 border-gray-200',
  tiktok: 'bg-black/10 text-gray-900 border-gray-300',
  youtube: 'bg-red-100 text-red-700 border-red-200',
  x: 'bg-blue-100 text-blue-700 border-blue-200',
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <span className="text-[10px]">📸</span>,
  threads: <Share2 size={11} />,
  youtube: <span className="text-[10px]">▶</span>,
  tiktok: <span className="text-[10px]">🎵</span>,
  x: <span className="text-[10px]">✕</span>,
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ScheduledPost | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/scheduled-posts');
        const data = await res.json();
        setPosts(data.posts || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const getPostsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return posts.filter(p => p.scheduled_at?.startsWith(dateStr));
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center">
            <CalendarIcon size={15} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">콘텐츠 캘린더</h1>
            <p className="text-xs text-gray-400">예약된 게시물을 한눈에 관리</p>
          </div>
        </div>
        <Link
          href="/cardnews"
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-colors"
        >
          <Plus size={14} /> 새 카드뉴스
        </Link>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-200 transition-colors">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <h2 className="text-lg font-bold text-gray-900">{year}년 {MONTHS[month]}</h2>
          <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-200 transition-colors">
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS.map((d, i) => (
              <div key={d} className={`py-3 text-center text-xs font-bold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-primary-400" />
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {Array.from({ length: totalCells }).map((_, idx) => {
                const day = idx - firstDay + 1;
                const isValid = day >= 1 && day <= daysInMonth;
                const isToday = isValid && day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const dayPosts = isValid ? getPostsForDay(day) : [];
                const colIdx = idx % 7;

                return (
                  <div
                    key={idx}
                    className={`min-h-[80px] md:min-h-[100px] p-1.5 border-b border-r border-gray-50 ${!isValid ? 'bg-gray-50/50' : 'hover:bg-gray-50/70'} transition-colors`}
                  >
                    {isValid && (
                      <>
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1 ${isToday ? 'bg-primary-600 text-white' : colIdx === 0 ? 'text-red-400' : colIdx === 6 ? 'text-blue-400' : 'text-gray-600'}`}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {dayPosts.slice(0, 2).map(post => (
                            <button
                              key={post.id}
                              onClick={() => setSelected(post)}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium border truncate ${PLATFORM_COLORS[post.platform] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
                            >
                              {PLATFORM_ICONS[post.platform]} {post.title || '예약 게시물'}
                            </button>
                          ))}
                          {dayPosts.length > 2 && (
                            <p className="text-[10px] text-gray-400 pl-1">+{dayPosts.length - 2}개</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-3 mt-4 flex-wrap">
          {Object.entries(PLATFORM_COLORS).map(([platform, cls]) => (
            <div key={platform} className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium ${cls}`}>
              {PLATFORM_ICONS[platform]} {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </div>
          ))}
        </div>

        {/* Upcoming Posts */}
        <div className="mt-6">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Clock size={14} className="text-gray-400" /> 예정된 게시물
          </h3>
          {posts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <p className="text-gray-300 text-3xl mb-3">📅</p>
              <p className="text-gray-500 font-semibold text-sm">예약된 게시물이 없습니다</p>
              <p className="text-gray-400 text-xs mt-1">카드뉴스를 만들고 예약 발행을 설정해 보세요</p>
              <Link href="/cardnews" className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-colors">
                <Plus size={13} /> 카드뉴스 만들기
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {posts.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()).slice(0, 10).map(post => {
                const d = new Date(post.scheduled_at);
                return (
                  <button
                    key={post.id}
                    onClick={() => setSelected(post)}
                    className="w-full bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 hover:border-primary-200 hover:shadow-sm transition-all text-left"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${PLATFORM_COLORS[post.platform] || 'bg-gray-100'}`}>
                      {PLATFORM_ICONS[post.platform] || <Share2 size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{post.title || '예약 게시물'}</p>
                      <p className="text-xs text-gray-400">{post.platform} · {d.getFullYear()}.{d.getMonth() + 1}.{d.getDate()} {d.getHours()}:{String(d.getMinutes()).padStart(2, '0')}</p>
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${post.status === 'published' ? 'bg-green-100 text-green-700' : post.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {post.status === 'published' ? '발행됨' : post.status === 'failed' ? '실패' : '예약중'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Post Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{selected.title || '예약 게시물'}</h3>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-16">플랫폼</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PLATFORM_COLORS[selected.platform] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {selected.platform}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-16">예약일시</span>
                <span>{new Date(selected.scheduled_at).toLocaleString('ko-KR')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-16">상태</span>
                <span className={`font-medium ${selected.status === 'published' ? 'text-green-600' : selected.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}`}>
                  {selected.status === 'published' ? '발행 완료' : selected.status === 'failed' ? '발행 실패' : '예약 대기'}
                </span>
              </div>
              {selected.caption && (
                <div>
                  <span className="text-gray-400">캡션</span>
                  <p className="mt-1 p-3 bg-gray-50 rounded-xl text-xs leading-relaxed whitespace-pre-wrap">{selected.caption}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
