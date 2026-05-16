'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
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
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const [contentOpen, setContentOpen] = useState(true);
  const [managementOpen, setManagementOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 라우트 변경 시 모바일 메뉴 닫기
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // 배경 스크롤 막기
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
        {/* 모바일 닫기 버튼 */}
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

        {/* 홈 대시보드 */}
        <Link href="/"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors mb-1 ${isActive('/') && pathname === '/' ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}>
          <LayoutDashboard size={16} className={pathname === '/' ? 'text-primary-600' : 'text-gray-400'} />
          <span>홈 대시보드</span>
        </Link>

        <div className="my-2 border-t border-gray-100" />

        {/* 브랜드 페르소나 */}
        <Link href="/persona"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors mb-2 ${isActive('/persona') ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}>
          <UserCircle2 size={16} className={isActive('/persona') ? 'text-primary-600' : 'text-gray-400'} />
          <span>브랜드 페르소나</span>
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

              <Link href="/cardnews#schedule"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 font-medium">
                <CalendarDays size={14} className="text-gray-400" />
                <span>예약 발행</span>
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
            </div>
          )}
        </div>

        <div className="my-2 border-t border-gray-100" />

        {/* 팀 */}
        <Link href="/workspace"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${isActive('/workspace') ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}>
          <Users size={16} className={isActive('/workspace') ? 'text-primary-600' : 'text-gray-400'} />
          <span>팀 워크스페이스</span>
          <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
        </Link>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <button className="w-full flex items-center justify-center gap-2 py-2 mb-2 rounded-lg border border-primary-200 text-primary-600 text-xs font-bold hover:bg-primary-50 bg-white shadow-sm">
          <Share2 size={14} /> SNS 계정 연동·관리
        </button>
        <button className="w-full flex items-center justify-center gap-2 py-2 mb-4 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-black shadow-sm">
          <Gift size={14} /> 친구 초대하고 혜택받기
        </button>

        <div className="text-[10px] text-gray-500 font-medium space-y-1.5">
          <div className="flex justify-between items-center">
            <span>free-trial</span>
            <div className="flex gap-2">
              <span>AI 60</span>
              <span>0/5 SNS 계정</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-gray-400">
            <span className="flex items-center gap-1"><span className="text-yellow-500">⭐</span> 퀘스트</span>
            <span>0/3</span>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <div className="hidden md:flex h-full">
        {sidebarContent}
      </div>

      {/* 모바일 햄버거 버튼 */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-40 md:hidden w-10 h-10 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
        aria-label="메뉴 열기"
      >
        <Menu size={20} />
      </button>

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
