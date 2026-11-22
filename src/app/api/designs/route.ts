import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
// 목록 읽기는 서버 키로 한다. anon 은 DB 시간 제한(약 3초)이 걸려 본문을 통째로 읽는 요청이 계속 실패했다.
// 이 라우트는 미들웨어에서 로그인한 사람만 열 수 있다.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
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
    // 목록은 가벼운 보기(표지 한 장 + 장수)를 읽는다. 보기가 아직 없으면(card_designs_list.sql 실행 전)
    // 예전처럼 전부 읽는다.
    const light = await admin.from('card_designs_list').select('*').order('created_at', { ascending: false });
    const { data, error } = light.error
      ? await admin.from('card_designs').select('*').order('created_at', { ascending: false })
      : light;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ designs: data });
  } catch (err) {
    console.error('designs GET error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
