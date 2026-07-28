import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 로그인 없이 접근 가능한 페이지 경로
const PUBLIC_PAGE_PATHS = ['/login', '/signup', '/auth/callback', '/share', '/view', '/privacy'];

// 인증 없이 허용할 API 경로 (이미지 프록시, 공유 등)
const PUBLIC_API_PATHS = [
  '/api/img',
  '/api/proxy-image',
  '/api/share',
  '/api/upload-to-cdn',   // CDN 업로드는 공개 (이미지 서빙용)
  '/api/instagram/auth',
  '/api/instagram/callback',
  '/api/instagram/webhook',  // Meta가 직접 호출 — 세션 쿠키 없음, 서명 검증(X-Hub-Signature-256)으로 보호
];

// 인증이 필요한 API 경로 prefix
const PROTECTED_API_PREFIXES = [
  '/api/generate',
  '/api/analyze',
  '/api/upload',
  '/api/designs',
  '/api/brand-kit',
  '/api/brand-persona',
  '/api/brand-style',
  '/api/brand-styles',
  '/api/scheduled-posts',
  '/api/templates',
  '/api/dashboard',
  '/api/workspace',
  '/api/instagram/settings',
  '/api/instagram/publish',
  '/api/instagram/insights',
  '/api/instagram/inbox',
  '/api/instagram/comments',
  '/api/instagram/dm',
  '/api/reference-research',
  '/api/dm-automation-rules',
  '/api/insights',
  '/api/comment-templates',
  '/api/comments',
  '/api/generate-caption',
  '/api/generate-card',
  '/api/suggest-image-search',
  '/api/upload-image',
  '/api/pexels',
  '/api/images',
  '/api/ai-designer',
  '/api/news-draft',
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // ── API 경로 처리 ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // 공개 API는 통과
    const isPublicApi = PUBLIC_API_PATHS.some(p => pathname.startsWith(p));
    if (isPublicApi) return addSecurityHeaders(response);

    // 보호된 API — 미인증이면 401
    const isProtectedApi = PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p));
    if (isProtectedApi && !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다', code: 'UNAUTHORIZED' },
        { status: 401, headers: securityHeaders() }
      );
    }

    return addSecurityHeaders(response);
  }

  // ── 페이지 경로 처리 ────────────────────────────────────────────────────────
  const isPublicPage = PUBLIC_PAGE_PATHS.some(p => pathname.startsWith(p));

  // 미로그인 → 보호된 페이지 접근 시 /login 으로
  if (!user && !isPublicPage) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 로그인 상태 → /login, /signup 접근 시 홈으로
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/cardnews', request.url));
  }

  return addSecurityHeaders(response);
}

function securityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  const headers = securityHeaders();
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v);
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
