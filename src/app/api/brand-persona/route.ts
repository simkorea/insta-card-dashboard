import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from('brand_personas')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persona: data });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand_name, tone, target_audience, keywords, industry, posting_goal, brand_color, emoji_style } = body;

    // upsert: 기존 레코드 있으면 업데이트, 없으면 생성
    const { data: existing } = await supabase.from('brand_personas').select('id').limit(1).maybeSingle();

    let result;
    if (existing?.id) {
      const { data, error } = await supabase
        .from('brand_personas')
        .update({ brand_name, tone, target_audience, keywords, industry, posting_goal, brand_color, emoji_style, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('brand_personas')
        .insert({ brand_name, tone, target_audience, keywords, industry, posting_goal, brand_color, emoji_style })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ persona: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
