import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase.from('brand_personas').select('*');

    // 로그인된 사용자가 있는 경우: user_id가 내 것이거나, user_id가 NULL(기존 데이터)인 행을 함께 조회
    if (user) {
      query = query.or(`user_id.eq.${user.id},user_id.is.null`);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ personas: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const { id, persona_name, brand_name, tone, target_audience, keywords, industry, posting_goal, brand_color, emoji_style } = body;

    if (!brand_name?.trim()) {
      return NextResponse.json({ error: '브랜드 이름을 입력해주세요' }, { status: 400 });
    }

    const userIdToSave = user ? user.id : null;
    const personaData = {
      persona_name: persona_name || brand_name || '기본 페르소나',
      brand_name,
      tone,
      target_audience,
      keywords: Array.isArray(keywords) ? keywords : [],
      industry,
      posting_goal,
      brand_color,
      emoji_style,
      updated_at: new Date().toISOString()
    };

    let result;

    if (id) {
      // id가 지정되어 있으면 업데이트
      const { data, error } = await supabase
        .from('brand_personas')
        .update(personaData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // id가 없으면 새로운 페르소나 추가
      const { data, error } = await supabase
        .from('brand_personas')
        .insert({
          ...personaData,
          user_id: userIdToSave
        })
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

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '삭제할 페르소나 ID가 필요합니다' }, { status: 400 });
    }

    const { error } = await supabase
      .from('brand_personas')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
