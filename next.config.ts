import type { NextConfig } from "next";

// 개발 환경에서 기업 프록시의 SSL 인증서 검증 오류 우회
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  // Vercel 빌드 파일 트레이싱이 playwright-core/browsers.json 같은 비-JS 자산을
  // 자동으로 못 찾아서 서버리스 번들에서 누락되는 문제 — 명시적으로 포함
  outputFileTracingIncludes: {
    '/api/reference-research/search': [
      './node_modules/playwright-core/**',
      './node_modules/@sparticuz/chromium/**',
    ],
    // 10시 크론도 헤드리스 크롬으로 카드를 그린다. 라우트마다 따로 적어야
    // 한다 — 안 적으면 그 함수 번들에서 크롬이 통째로 빠져 배포 후에야
    // 알게 된다.
    '/api/cron/instagram': [
      './node_modules/playwright-core/**',
      './node_modules/@sparticuz/chromium/**',
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
};

export default nextConfig;
