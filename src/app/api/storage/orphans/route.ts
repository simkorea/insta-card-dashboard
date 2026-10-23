import { NextRequest, NextResponse } from 'next/server';
import { cleanupOrphans } from '@/lib/storage/cardImages';

// 어디에서도 쓰이지 않는 그림 정리. 매일 크론이 같은 함수를 부르고, 여기서는 사람이 확인·실행한다.
// GET = 지울 것을 세어 보기만 한다(dryRun). POST = 실제로 지운다.

export const maxDuration = 120;

export async function GET() {
  try {
    return NextResponse.json(await cleanupOrphans({ dryRun: true }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    return NextResponse.json(await cleanupOrphans());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
