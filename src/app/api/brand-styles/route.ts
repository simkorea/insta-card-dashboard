import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from('brand_styles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ styles: data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, primary_color, accent_color, bg_style, font_style, mood, overlay_strength, layout_style, color_palette, description } = body;

    if (!name) return NextResponse.json({ error: 'name이 필요합니다' }, { status: 400 });

    const { data, error } = await supabase
      .from('brand_styles')
      .insert({ name, primary_color, accent_color, bg_style, font_style, mood, overlay_strength, layout_style, color_palette, description })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ style: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
