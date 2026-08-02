import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 브랜드킷은 brand_styles 테이블의 '__brand_kit__' 한 행에 저장한다.
//
// 예전에는 anon key를 썼는데 RLS에 막혀 UPDATE가 0건 처리되고, 이어지는
// .single()이 "Cannot coerce the result to a single JSON object"로 터졌다.
// 클라이언트는 그 에러를 삼키고 '저장됨'을 띄워서, 실제로는 localStorage만
// 바뀌고 서버에는 한 번도 저장되지 않고 있었다(같은 브라우저에서만 유지됨).
// → service role로 접근한다. CLAUDE.md의 Supabase 주의사항과 같은 사고 유형.
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const TABLE = 'brand_styles';
const KIT_NAME = '__brand_kit__';

export async function GET() {
  const supabase = serviceClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase 설정이 없습니다.' }, { status: 500 });

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
    const supabase = serviceClient();
    if (!supabase) return NextResponse.json({ error: 'Supabase 설정이 없습니다.' }, { status: 500 });

    const body = await req.json();
    const { logo_url, primary_color, secondary_color, font_family, brand_name } = body;

    const row = {
      primary_color,
      accent_color: secondary_color,
      description: logo_url,
      font_style: font_family,
      layout_style: brand_name,
    };

    const { data: existing } = await supabase
      .from(TABLE)
      .select('id')
      .eq('name', KIT_NAME)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 행이 실제로 갱신·생성됐는지 확인한다. 0건이면 조용히 넘어가지 않고 에러를 낸다.
    const query = existing?.id
      ? supabase.from(TABLE).update(row).eq('id', existing.id).select()
      : supabase.from(TABLE).insert({ name: KIT_NAME, ...row }).select();

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '브랜드킷이 저장되지 않았습니다.' }, { status: 500 });
    }

    return NextResponse.json({ kit: data[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
