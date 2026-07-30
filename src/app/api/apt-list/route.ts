import { parseTransactions } from '@/lib/aptList/parseTransactions';
import { buildAptListCards } from '@/lib/aptList/buildCards';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// 실거래가 표를 붙여넣으면 단지별 노트 스타일 카드뉴스를 만들어 보관함에 저장한다.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { raw, title, ratio, noteNumber, limit } = await request.json();

    if (!raw || typeof raw !== 'string' || raw.trim().length < 20) {
      return NextResponse.json({ error: '실거래가 표를 붙여넣어 주세요.' }, { status: 400 });
    }

    const { records, warning } = parseTransactions(raw);
    if (records.length === 0) {
      return NextResponse.json({ error: warning || '표에서 단지를 찾지 못했습니다.' }, { status: 422 });
    }

    const picked = records.slice(0, Math.min(Number(limit) || 8, 10));
    const pages = await buildAptListCards({
      records: picked,
      title: (title || '실거래가로 본 아파트').trim(),
      ratio: ratio || '4:5',
      noteNumber,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase 설정이 없습니다.' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const label = `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`;

    const { data: design, error } = await supabase
      .from('card_designs')
      .insert({
        name: `[단지] ${label} ${(title || '실거래가 아파트').trim()}`,
        description: `apt-list:${picked.length}개 단지`,
        pages_data: pages,
        category: '단지 리스트',
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: `저장 실패: ${error.message}` }, { status: 500 });

    return NextResponse.json({
      designId: design.id,
      slides: pages.length,
      complexes: picked.length,
      parsedTotal: records.length,
      preview: picked.map(r => ({
        name: r.name,
        region: r.region,
        pyeong: r.pyeong,
        priceText: r.priceText,
        builtYear: r.builtYear,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '알 수 없는 오류' }, { status: 500 });
  }
}
