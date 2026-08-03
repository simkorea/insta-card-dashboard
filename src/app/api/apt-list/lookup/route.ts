import { NextRequest, NextResponse } from 'next/server';
import { fetchMolitTrades } from '@/lib/aptList/fetchMolit';
import { findSigungu } from '@/lib/aptList/lawdCodes';

// 지역·기간·금액대로 실거래를 조회해서 단지 목록을 돌려준다.
// 카드 생성(/api/apt-list)과 분리해 둔 이유: 사용자가 카드를 만들기 전에
// 어떤 단지가 잡혔는지 먼저 보고 고를 수 있어야 하기 때문.

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { lawdCd, months, minPrice, maxPrice } = await request.json();

    if (!lawdCd || !findSigungu(String(lawdCd))) {
      return NextResponse.json({ error: '지역을 선택해주세요.' }, { status: 400 });
    }

    const result = await fetchMolitTrades({
      lawdCd: String(lawdCd),
      months: Number(months) || 3,
      minPriceManwon: Number(minPrice) || undefined,
      maxPriceManwon: Number(maxPrice) || undefined,
    });

    if (!result.ok) {
      // 키 문제·한도 초과는 사용자가 조치해야 하는 것이라 그대로 전달한다
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      records: result.records,
      matched: result.records.length,
      scanned: result.totalCount,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '알 수 없는 오류' }, { status: 500 });
  }
}
