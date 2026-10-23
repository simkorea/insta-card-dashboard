import { NextResponse } from 'next/server';
import { listSites } from '@/lib/sites/siteFacts';

// 근거 자료가 있는 현장 목록 (주제 추천 화면의 선택 상자용)
export async function GET() {
  try {
    return NextResponse.json({ sites: await listSites() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
