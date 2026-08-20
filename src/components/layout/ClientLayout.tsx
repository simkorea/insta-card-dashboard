'use client';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/components/providers/AuthProvider';
import Sidebar from '@/components/layout/Sidebar';

// 사이드바/하단 메뉴를 감출 경로.
// '/render'는 서버가 카드를 캡처하는 화면이라 앱 껍데기가 있으면 안 된다 —
// 실제로 하단 메뉴가 카드 위에 겹쳐 찍혔다.
const AUTH_PATHS = ['/login', '/signup', '/auth/callback', '/privacy', '/render'];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some(p => pathname.startsWith(p));

  return (
    <AuthProvider>
      {!isAuthPage && <Sidebar />}
      <main className={`flex-1 overflow-y-auto bg-white pt-0 pb-16 md:pb-0 ${isAuthPage ? 'w-full' : ''}`}>
        {children}
      </main>
    </AuthProvider>
  );
}
