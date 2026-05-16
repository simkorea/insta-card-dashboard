import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { pages_data, title } = await req.json();
    if (!pages_data) return NextResponse.json({ error: 'pages_data 필요' }, { status: 400 });

    const token = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

    const { data, error } = await supabase
      .from('card_designs')
      .insert({
        title: title || '공유된 카드뉴스',
        data: pages_data,
        share_token: token,
        is_public: true,
      })
      .select('share_token')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ token: data.share_token });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token 필요' }, { status: 400 });

  const { data, error } = await supabase
    .from('card_designs')
    .select('title, data, created_at')
    .eq('share_token', token)
    .eq('is_public', true)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: '공유 링크를 찾을 수 없습니다' }, { status: 404 });
  return NextResponse.json({ title: data.title, pages_data: data.data, created_at: data.created_at });
}
