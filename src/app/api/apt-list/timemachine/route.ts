import { NextRequest, NextResponse } from 'next/server';
import { fetchTimeMachine } from '@/lib/aptList/timeMachine';

// 같은 단지의 시점별 실거래가를 모아 돌려준다.
// 시점당 여러 달을 조회하므로 일반 조회보다 오래 걸린다(15회 내외).
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const { lawdCd, items } = await request.json();

    if (!lawdCd) return NextResponse.json({ error: '지역을 선택해주세요.' }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '단지를 하나 이상 골라주세요.' }, { status: 400 });
    }
    // 단지가 많다고 조회 수가 늘지는 않지만(달 단위로 한 번씩 부른다),
    // 카드 한 장에 세 단지가 한계라 여기서 자른다.
    const picked = items.slice(0, 3).map((i: any) => ({
      name: String(i?.name || '').trim(),
      areaM2: Number(i?.areaM2) || undefined,
    })).filter((i: { name: string }) => i.name);

    if (picked.length === 0) {
      return NextResponse.json({ error: '단지명을 읽지 못했습니다.' }, { status: 400 });
    }

    const result = await fetchTimeMachine({ lawdCd, items: picked });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

    return NextResponse.json({
      rows: result.rows,
      monthsQueried: result.monthsQueried,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '알 수 없는 오류' }, { status: 500 });
  }
}
