'use client';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/components/providers/AuthProvider';
import Sidebar from '@/components/layout/Sidebar';

const AUTH_PATHS = ['/login', '/signup', '/auth/callback'];

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
