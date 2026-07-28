import { generateNewsCardnewsDraft } from '@/lib/newsCardnews/generateDraft';
import { NextRequest, NextResponse } from 'next/server';

// 대시보드의 "지금 만들기" 버튼용. 크론을 기다리지 않고 최신 브리핑으로 초안을 만든다.
// 로그인 필요 (middleware의 PROTECTED_API_PREFIXES).
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let force = false;
  try {
    const body = await request.json();
    force = body?.force === true;
  } catch {
    // 본문 없이 호출해도 된다
  }

  const result = await generateNewsCardnewsDraft({ force });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
