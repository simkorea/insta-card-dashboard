'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Film,
  PenTool,
  LayoutDashboard,
  CalendarDays,
  BarChart2,
  MessageSquare,
  Bot,
  Share2,
  Gift,
  ChevronDown,
  ChevronRight,
  Layout,
  Video,
  FileText,
  Users,
  UserCircle2,
  X,
  Home,
  Calendar,
  MoreHorizontal,
  Sparkles,
  Palette,
  LogOut,
  Archive,
  Search,
  Zap,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [contentOpen, setContentOpen] = useState(true);
  const [managementOpen, setManagementOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const sidebarContent = (
    <aside className="w-64 border-r border-gray-100 bg-white flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-5 flex items-center gap-2">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-black text-xl leading-none">s</span>
        </div>
        <span className="text-xl font-bold tracking-tight text-gray-900">simple</span>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 md:hidden"
        >
          <X size={18} />
        </button>
      </div>

      {/* Workspace Selector */}
      <div className="px-4 mb-4">
        <Link href="/workspace" className={`flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 cursor-pointer text-sm transition-colors ${isActive('/workspace') ? 'bg-primary-50' : ''}`}>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center">
              <span className="text-xs font-medium text-gray-600">P</span>
            </div>
            <span className="font-semibold text-gray-700">Personal Workspace</span>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        <Link href="/"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors mb-1 ${isActive('/') && pathname === '/' ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}>
          <LayoutDashboard size={16} className={pathname === '/' ? 'text-primary-600' : 'text-gray-400'} />
          <span>홈 대시보드</span>
        </Link>

        <Link href="/archive"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors mb-1 ${isActive('/archive') ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}>
          <Archive size={16} className={isActive('/archive') ? 'text-primary-600' : 'text-gray-400'} />
          <span>내 보관함</span>
        </Link>

        <div className="my-2 border-t border-gray-100" />

        <Link href="/persona"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${isActive('/persona') ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}>
          <UserCircle2 size={16} className={isActive('/persona') ? 'text-primary-600' : 'text-gray-400'} />
          <span>브랜드 페르소나</span>
        </Link>

        <Link href="/brand-kit"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors mb-2 ${isActive('/brand-kit') ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}>
          <Palette size={16} className={isActive('/brand-kit') ? 'text-primary-600' : 'text-gray-400'} />
          <span>브랜드 키트</span>
          <span className="ml-auto text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
        </Link>

        <div className="my-2 border-t border-gray-100" />

        {/* AI 콘텐츠 제작 */}
        <div className="mb-1">
          <button
            onClick={() => setContentOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-gray-800 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <PenTool size={16} className="text-gray-500" />
              <span>AI 콘텐츠 제작</span>
            </div>
            {contentOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          </button>

          {contentOpen && (
            <div className="mt-1 ml-4 border-l-2 border-gray-100 pl-2 space-y-0.5">
              <Link href="/cardnews"
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/cardnews') ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <div className="flex items-center gap-2">
                  <Layout size={14} className={isActive('/cardnews') ? 'text-primary-600' : 'text-gray-400'} />
                  <span>카드뉴스 생성</span>
                </div>
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">추천</span>
              </Link>

              <Link href="/social-post"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/social-post') ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <Share2 size={14} className={isActive('/social-post') ? 'text-primary-600' : 'text-gray-400'} />
                <span>소셜 포스트</span>
                <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
              </Link>

              <Link href="/blog-generator"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/blog-generator') ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <FileText size={14} className={isActive('/blog-generator') ? 'text-primary-600' : 'text-gray-400'} />
                <span>블로그 생성</span>
                <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
              </Link>

              <Link href="/video-generator"
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/video-generator') ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <div className="flex items-center gap-2">
                  <Video size={14} className={isActive('/video-generator') ? 'text-primary-600' : 'text-gray-400'} />
                  <span>영상 생성</span>
                </div>
                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">Beta</span>
              </Link>

              <Link href="/reels"
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/reels') ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <div className="flex items-center gap-2">
                  <Film size={14} className={isActive('/reels') ? 'text-primary-600' : 'text-gray-400'} />
                  <span>릴스·쇼츠 업로드</span>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
              </Link>
            </div>
          )}
        </div>

        <div className="my-2 border-t border-gray-100" />

        {/* 운영 관리 */}
        <div className="mb-1">
          <button
            onClick={() => setManagementOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-gray-800 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard size={16} className="text-gray-500" />
              <span>운영 관리</span>
            </div>
            {managementOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          </button>

          {managementOpen && (
            <div className="mt-1 ml-4 border-l-2 border-gray-100 pl-2 space-y-0.5">
              <Link href="/cardnews#analytics"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 font-medium">
                <BarChart2 size={14} className="text-gray-400" />
                <span>성과 대시보드</span>
              </Link>

              <Link href="/calendar"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/calendar') ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <CalendarDays size={14} className={isActive('/calendar') ? 'text-primary-600' : 'text-gray-400'} />
                <span>콘텐츠 캘린더</span>
              </Link>

              <Link href="/comments"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/comments') ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <MessageSquare size={14} className={isActive('/comments') ? 'text-primary-600' : 'text-gray-400'} />
                <span>댓글 템플릿</span>
                <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
              </Link>

              <Link href="/auto-dm"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/auto-dm') ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <Bot size={14} className={isActive('/auto-dm') ? 'text-primary-600' : 'text-gray-400'} />
                <span>자동 DM</span>
                <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
              </Link>

              <Link href="/reference-research"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/reference-research') ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <Search size={14} className={isActive('/reference-research') ? 'text-primary-600' : 'text-gray-400'} />
                <span>레퍼런스 리서치</span>
                <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
              </Link>

              <Link href="/apt-list"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/apt-list') ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <Search size={14} className={isActive('/apt-list') ? 'text-primary-600' : 'text-gray-400'} />
                <span>단지 리스트</span>
                <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
              </Link>

              <Link href="/dm-automation"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/dm-automation') ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                <Zap size={14} className={isActive('/dm-automation') ? 'text-primary-600' : 'text-gray-400'} />
                <span>키워드 자동 DM</span>
                <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
              </Link>
            </div>
          )}
        </div>

        <div className="my-2 border-t border-gray-100" />

        <Link href="/workspace"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${isActive('/workspace') ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}>
          <Users size={16} className={isActive('/workspace') ? 'text-primary-600' : 'text-gray-400'} />
          <span>팀 워크스페이스</span>
          <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
        </Link>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <Link href="/sns-settings" className="w-full flex items-center justify-center gap-2 py-2 mb-2 rounded-lg border border-primary-200 text-primary-600 text-xs font-bold hover:bg-primary-50 bg-white shadow-sm">
          <Share2 size={14} /> SNS 계정 연동·관리
        </Link>
        {/* 예전에는 onClick이 없어 눌러도 아무 일도 안 일어났다.
            실제 초대 기능은 /workspace(팀 워크스페이스)에 있으므로 그리로 보낸다. */}
        <Link
          href="/workspace"
          className="w-full flex items-center justify-center gap-2 py-2 mb-3 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-black active:scale-[0.99] shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          <Gift size={14} /> 팀원 초대하기
        </Link>

        {user && (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              {/* 'free-trial · AI 60'은 하드코딩된 문구였다. 플랜·크레딧을
                  담는 테이블 자체가 없어 실제 상태와 무관한 값이라 지웠다.
                  요금제가 실제로 생기면 그때 진짜 값을 넣는다. */}
              <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="로그아웃"
              className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  // 모바일 하단 네비게이션 항목
  const bottomNavItems = [
    { href: '/', icon: Home, label: '홈', exact: true },
    { href: '/cardnews', icon: Sparkles, label: '만들기', exact: false },
    { href: '/brand-kit', icon: Palette, label: '브랜드', exact: false },
    { href: '/calendar', icon: Calendar, label: '캘린더', exact: false },
  ];

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <div className="hidden md:flex h-full">
        {sidebarContent}
      </div>

      {/* 모바일 하단 네비게이션 바 */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 flex md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {bottomNavItems.map((item) => {
          const isItemActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href) && item.href !== '/';
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors active:bg-gray-50 ${isItemActive ? 'text-primary-600' : 'text-gray-400'}`}
            >
              <item.icon size={21} strokeWidth={isItemActive ? 2.5 : 1.8} />
              <span className={`text-[10px] font-medium ${isItemActive ? 'text-primary-600' : 'text-gray-400'}`}>{item.label}</span>
            </Link>
          );
        })}
        {/* 더보기 버튼 — 드로어 열기 */}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-gray-400 active:bg-gray-50 transition-colors"
        >
          <MoreHorizontal size={21} strokeWidth={1.8} />
          <span className="text-[10px] font-medium">더보기</span>
        </button>
      </nav>

      {/* 모바일 드로어 오버레이 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 모바일 드로어 */}
      <div className={`fixed inset-y-0 left-0 z-50 md:hidden flex h-full transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </div>

    </>
  );
}
