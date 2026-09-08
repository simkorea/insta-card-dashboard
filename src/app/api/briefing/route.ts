import { NextResponse } from "next/server";
import { runDailyBriefing } from "@/lib/briefing/runDailyBriefing";

// 아침 브리핑 크론(23:00 UTC = 08:00 KST).
//
// 실제 처리는 runDailyBriefing 이 한다. 10시 크론도 "오늘 브리핑이 없다"를
// 발견하면 같은 함수를 부르기 때문에, 기준을 바꾸면 양쪽이 같이 바뀐다.
//
// Hobby 플랜은 프로젝트당 크론이 2개까지다. 3개를 걸어놨더니 23시대 두 개가
// 실행되지 않았다(로그 확인: 09시 크론만 호출됨). 그래서 브리핑이 끝나면
// 카드뉴스 초안까지 여기서 이어 만든다 — 30분 대기도 없어져 더 빠르다.
// 대시보드를 열 때도 이 라우트가 불리므로, 크론일 때만 이어서 돌린다.
export const maxDuration = 300; // 5분

export async function GET(request: Request) {
  const isCron = request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;

  const result = await runDailyBriefing({ withCardnews: isCron });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    message: "일일 브리핑이 성공적으로 생성되어 저장되었습니다.",
    data: result.data,
    cardnews: result.cardnews,
  });
}
