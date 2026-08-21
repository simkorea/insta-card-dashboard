import { NextResponse } from 'next/server';
import { siteOrigin } from '@/lib/cardnews/captureSlides';

// 오늘 몫을 지금 돌린다 — 10시 크론이 하는 일을 사람이 눌러서 시작한다.
//
// 크론이 하루를 건너뛰면(오늘처럼) 그날 카드뉴스와 블로그가 통째로 빈다.
// 다음 날까지 기다리면 그 뉴스는 이미 지난 뉴스다.
//
// 일은 크론 라우트가 그대로 한다. 여기서 같은 코드를 다시 쓰지 않는다 —
// 두 벌로 두면 한쪽만 고쳐져 손으로 돌린 날만 결과가 달라진다.
// 크론은 CRON_SECRET 만 받으므로 서버가 그 값을 실어 자기 자신을 부른다.
//
// ⚠️ 실제로 인스타그램에 발행된다. 로그인한 사람만 열 수 있다.
export const maxDuration = 300;

export async function POST() {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET 이 설정되어 있지 않습니다.' }, { status: 500 });
  }

  const startedAt = Date.now();
  try {
    const res = await fetch(`${siteOrigin()}/api/cron/instagram`, {
      headers: { authorization: `Bearer ${secret}` },
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, status: res.status, ms: Date.now() - startedAt, ...body });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, ms: Date.now() - startedAt, error: msg }, { status: 500 });
  }
}
