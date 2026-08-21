import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { captureDesignSlides, siteOrigin } from '@/lib/cardnews/captureSlides';

// 운영에서 헤드리스 크롬이 실제로 뜨는지 확인하는 자리.
//
// 왜 따로 두는가: 10시 크론은 그리고 나서 곧바로 인스타에 올린다. 크롬만
// 시험해 보려고 그걸 부를 수는 없다 — 발행은 되돌릴 수 없다. 여기서는
// 그림만 만들어 주소를 돌려주고, 예약도 발행도 DB 기록도 하지 않는다.
//
// 로그인한 사람만 열 수 있다(/api/designs 는 보호 경로다).
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: 'Supabase 설정 없음' }, { status: 500 });

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let id = new URL(request.url).searchParams.get('id') || '';
  if (!id) {
    // 지정이 없으면 가장 최근 자동 초안으로 시험한다
    const { data } = await supabase
      .from('card_designs')
      .select('id')
      .eq('category', '자동 뉴스')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    id = data?.id || '';
  }
  if (!id) return NextResponse.json({ ok: false, error: '시험할 초안이 없습니다.' }, { status: 404 });

  const startedAt = Date.now();
  const shot = await captureDesignSlides(id, 200_000);

  return NextResponse.json({
    designId: id,
    origin: siteOrigin(),
    env: process.env.NODE_ENV,
    ms: Date.now() - startedAt,
    ...shot,
  });
}
