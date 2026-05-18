import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('No URL', { status: 400 });

  try {
    const res = await fetch(url);
    if (!res.ok) return new NextResponse('Fetch failed', { status: 502 });
    const contentType = res.headers.get('content-type') || 'image/png';
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Error', { status: 500 });
  }
}
