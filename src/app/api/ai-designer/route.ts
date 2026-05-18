import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { pageData, message } = await request.json();
    if (!message || !pageData) {
      return NextResponse.json({ error: 'message와 pageData가 필요합니다' }, { status: 400 });
    }

    const prompt = `당신은 카드뉴스 디자인 AI 어시스턴트입니다. 사용자의 요청을 분석해서 슬라이드 데이터를 수정해주세요.

현재 슬라이드 데이터:
${JSON.stringify(pageData, null, 2)}

사용자 요청: "${message}"

[수정 규칙]
- titleStyle.fontSize: 제목 크기 (기본 38, 범위 18~80)
- subtitleStyle.fontSize: 부제 크기 (기본 14, 범위 10~32)
- bulletStyle.fontSize: 본문 크기 (기본 14, 범위 10~28)
- fontWeight: "300"(가늘게) | "400"(보통) | "600"(굵게) | "900"(매우 굵게)
- color: "#hex" 형식
- "더 밝게" → overlay의 rgba 투명도를 낮춤 (예: rgba(0,0,0,0.85) → rgba(0,0,0,0.55))
- "더 어둡게" → overlay의 rgba 투명도를 높임 (예: rgba(0,0,0,0.55) → rgba(0,0,0,0.85))
- "따뜻한 톤" → overlay에 amber/orange 틴트 추가
- "차가운 톤" → overlay에 blue 틴트 추가
- "폰트 크게" → 모든 fontSize 20% 증가
- "폰트 작게" → 모든 fontSize 20% 감소

아래 JSON 형식으로만 응답하세요 (수정이 필요한 필드만 포함):
{
  "changes": {
    "title": "수정된 제목 (내용 변경 시만)",
    "subtitle": "수정된 부제 (내용 변경 시만)",
    "bullets": ["수정된 항목들 (내용 변경 시만)"],
    "titleStyle": { "fontSize": 42, "fontWeight": "900", "color": "#FFFFFF" },
    "subtitleStyle": { "fontSize": 16, "color": "#E5E7EB" },
    "bulletStyle": { "fontSize": 15, "color": "#FFFFFF" },
    "overlay": "linear-gradient(...)"
  },
  "message": "수정 내용을 한국어로 짧게 설명 (1-2문장)"
}`;

    let text = await generateWithRetry(prompt);
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
