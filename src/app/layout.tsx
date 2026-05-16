import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "simple",
  description: "AI 카드뉴스 & SNS 콘텐츠 자동화",
  openGraph: {
    title: "simple",
    description: "AI 카드뉴스 & SNS 콘텐츠 자동화",
    siteName: "simple",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="light" style={{ colorScheme: 'light' }} suppressHydrationWarning>
      <body className={`${inter.className} flex h-screen overflow-hidden bg-white text-[var(--foreground)]`} suppressHydrationWarning>
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-white pt-0 pb-16 md:pb-0">
          {children}
        </main>
      </body>
    </html>
  );
}
