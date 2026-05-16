import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const perPage = Math.min(Number(searchParams.get('per_page') || '6'), 30);
  const page = Number(searchParams.get('page') || '1');
  const orientation = searchParams.get('orientation') || 'portrait';

  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return NextResponse.json({ error: 'UNSPLASH_ACCESS_KEY is missing' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=${orientation}`,
      { headers: { Authorization: `Client-ID ${accessKey}` } }
    );

    if (!res.ok) throw new Error(`Unsplash ${res.status}`);

    const data = await res.json();

    const photos = (data.results || []).map((p: any) => ({
      id: p.id,
      url: p.urls?.regular || '',
      thumbUrl: p.urls?.small || '',
      fullUrl: p.urls?.full || '',
      author: p.user?.name || '',
      authorUrl: p.user?.links?.html || '',
      color: p.color || '#cccccc',
      description: p.alt_description || p.description || '',
    }));

    // 단일 imageUrl 호환 (기존 코드 하위 호환)
    const imageUrl = photos[0]?.url || '';

    return NextResponse.json({ imageUrl, photos, total: data.total || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
