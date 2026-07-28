import { generateNewsCardnewsDraft } from '@/lib/newsCardnews/generateDraft';
import { NextRequest, NextResponse } from 'next/server';

// 아침 브리핑이 만들어진 직후 실행되어, 그날 뉴스로 카드뉴스 "초안"을 만들어 둔다.
// 자동으로 발행하지 않는다 — 내 보관함에 저장만 하고 사람이 확인 후 발행한다.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await generateNewsCardnewsDraft();
  if (!result.ok) {
    console.error('[NewsCardnews:cron] 실패:', result.error);
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true, ...result });
}
