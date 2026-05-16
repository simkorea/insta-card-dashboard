import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { name, description, pagesData } = await request.json();

    if (!name?.trim() || !pagesData) {
      return NextResponse.json({ error: 'name과 pagesData가 필요합니다' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('card_designs')
      .insert({ name: name.trim(), description: description?.trim() || null, pages_data: pagesData })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ design: data });
  } catch (err) {
    console.error('designs POST error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('card_designs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ designs: data });
  } catch (err) {
    console.error('designs GET error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
