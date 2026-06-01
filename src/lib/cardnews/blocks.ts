// 카드뉴스 레이아웃 블록 타입. 모든 px 값은 420px 폭 캔버스 좌표계 기준.
export type BaseBlock =
  | { type: 'eyebrow'; text: string }                            // 섹션 라벨 (LOCATION / PRICE …)
  | { type: 'headline'; text: string; accentText?: string }      // 메인 타이틀 (accentText는 강조색으로)
  | { type: 'sub'; text: string }
  | { type: 'bigNumber'; value: string; caption?: string }       // 큰 숫자 (예: 7억대)
  | { type: 'statGrid'; cols?: 2 | 3 | 4; items: { value: string; label: string }[] }
  | { type: 'compareTable'; rows: { label: string; value: string; highlight?: boolean }[] }
  | { type: 'timeline'; items: { date: string; title: string; desc?: string; state?: 'done' | 'active' | 'todo' }[] }
  | { type: 'checklist'; items: string[] }
  | { type: 'badgeRow'; badges: { text: string; tone?: 'gold' | 'green' | 'neutral' }[] }
  | { type: 'sourceNote'; text: string };                        // 출처 표기

export type SlideBlock = BaseBlock & {
  offsetY?: number;
};

export type BrandTone = 'gold' | 'sage';   // 왕숙형=gold, 소요한남형=sage
