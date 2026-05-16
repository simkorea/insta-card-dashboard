import { NextRequest, NextResponse } from 'next/server';

export interface PexelsPhoto {
  id: number;
  photographer: string;
  photographer_url: string;
  src: {
    medium: string;
    large: string;
    original: string;
  };
  alt: string;
  width: number;
  height: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const page = searchParams.get('page') || '1';
  const perPage = searchParams.get('per_page') || '9';

  if (!query.trim()) {
    return NextResponse.json({ photos: [], total_results: 0 });
  }

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Pexels API key not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=landscape`,
      { headers: { Authorization: apiKey } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Pexels API error' }, { status: res.status });
    }

    const data = await res.json();

    const photos: PexelsPhoto[] = (data.photos || []).map((p: PexelsPhoto) => ({
      id: p.id,
      photographer: p.photographer,
      photographer_url: p.photographer_url,
      src: {
        medium: p.src.medium,
        large: p.src.large,
        original: p.src.original,
      },
      alt: p.alt || query,
      width: p.width,
      height: p.height,
    }));

    return NextResponse.json({
      photos,
      total_results: data.total_results,
      page: data.page,
      per_page: data.per_page,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch from Pexels' }, { status: 500 });
  }
}
