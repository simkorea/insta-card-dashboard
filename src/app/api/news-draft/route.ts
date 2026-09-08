import { generateNewsCardnewsDraft } from '@/lib/newsCardnews/generateDraft';
import { NextRequest, NextResponse } from 'next/server';

// 대시보드의 "지금 만들기" 버튼용. 크론을 기다리지 않고 최신 브리핑으로 초안을 만든다.
// 로그인 필요 (middleware의 PROTECTED_API_PREFIXES).
export const maxDuration = 300;

// AI가 카드를 통째로 그리는 방식 — Gemini(gemini-3-pro-image) 유료 호출이다.
// 2026-08 실측 장당 약 ₩270, 10장이면 약 ₩2,700 + 장마다 글자 검증(비전 모델) 1회.
const PAID_STYLES = ['notebook', 'newspaper'] as const;
// 미리 뽑아둔 종이·펜그림 위에 브라우저가 글자를 얹는다. AI 호출 0회 = 0원.
const FREE_STYLES = ['hybrid', 'hybridPaper'] as const;

type Style = (typeof PAID_STYLES)[number] | (typeof FREE_STYLES)[number];

export async function POST(request: NextRequest) {
  let force = false;
  // 기본값은 무료(hybrid)다.
  //
  // 예전 기본값은 'notebook'이었다. 화면의 '다시 만들기'는 cardStyle을 보내지
  // 않으므로, 누르는 사람은 모른 채 매번 유료 그림 10장이 그려졌다.
  // 돈이 나가는 길은 눌러서 고른 경우에만 간다.
  let cardStyle: Style = 'hybrid';
  let paid = false;

  try {
    const body = await request.json();
    force = body?.force === true;
    const asked = body?.cardStyle;
    if ((FREE_STYLES as readonly string[]).includes(asked)) {
      cardStyle = asked as Style;
    } else if ((PAID_STYLES as readonly string[]).includes(asked)) {
      // 유료 방식은 호출한 쪽이 비용을 알고 있다고 명시해야 간다.
      // 실수로 흘러드는 걸 막는 이중 잠금이다.
      if (body?.confirmPaid !== true) {
        return NextResponse.json(
          { error: `'${asked}'는 AI가 카드를 그리는 유료 방식입니다. confirmPaid: true 를 함께 보내주세요.` },
          { status: 400 },
        );
      }
      cardStyle = asked as Style;
      paid = true;
    }
  } catch {
    // 본문 없이 호출해도 된다 — 무료 방식으로 만든다
  }

  const result = await generateNewsCardnewsDraft({ force, cardStyle });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ...result, cardStyle, paid });
}
