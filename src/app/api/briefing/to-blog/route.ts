import { NextRequest, NextResponse } from "next/server";
import { saveBriefingAsBlog } from "@/lib/blog/saveBriefingAsBlog";

// 브리핑 → 블로그 글 저장.
//
// 실제 처리는 saveBriefingAsBlog 가 한다. 10시 자동 크론도 같은 함수를
// 쓰기 때문에, 기준을 바꾸면 손으로 만든 글과 자동으로 만든 글이 같이 바뀐다.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let briefingId: string | undefined;
  try {
    const body = await request.json();
    briefingId = body?.briefingId;
  } catch {
    // Body 가 없으면 최신 브리핑을 쓴다
  }

  const result = await saveBriefingAsBlog(briefingId);

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    success: true,
    skipped: result.skipped,
    postId: result.postId,
  });
}
