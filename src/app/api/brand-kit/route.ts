import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TABLE = 'brand_styles';
const KIT_NAME = '__brand_kit__';

export async function GET() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('name', KIT_NAME)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kit: data ?? null });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { logo_url, primary_color, secondary_color, font_family, brand_name } = body;

    const { data: existing } = await supabase
      .from(TABLE)
      .select('id')
      .eq('name', KIT_NAME)
      .maybeSingle();

    let result;
    if (existing?.id) {
      const { data, error } = await supabase
        .from(TABLE)
        .update({ primary_color, accent_color: secondary_color, description: logo_url, font_style: font_family, layout_style: brand_name })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      result = data;
    } else {
      const { data, error } = await supabase
        .from(TABLE)
        .insert({ name: KIT_NAME, primary_color, accent_color: secondary_color, description: logo_url, font_style: font_family, layout_style: brand_name })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      result = data;
    }

    return NextResponse.json({ kit: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
