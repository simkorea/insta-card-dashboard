import { generateNewsCardnewsDraft } from '@/lib/newsCardnews/generateDraft';
import { NextRequest, NextResponse } from 'next/server';

// 그날 뉴스로 카드뉴스 "초안"을 만든다. 자동 발행하지 않는다 —
// 내 보관함에 저장만 하고 사람이 확인 후 발행한다.
//
// 크론에서는 빠졌다. Hobby 플랜은 프로젝트당 크론이 2개까지인데 3개를
// 걸어놨더니 23시대 두 개가 실행되지 않았다(로그로 확인). 그래서 초안 생성은
// /api/briefing이 브리핑을 만든 뒤 이어서 처리한다.
// 이 라우트는 수동으로 다시 만들 때를 위해 남겨둔다.
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
