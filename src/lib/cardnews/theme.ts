import type { BrandTone } from './blocks';

// 브랜드 색 토큰 (gold=왕숙형, sage=소요한남형)
export const TONE = {
  gold: { accent: '#E9B949', accentSoft: 'rgba(233,185,73,0.16)', good: '#5BD08A' },
  sage: { accent: '#CBB994', accentSoft: 'rgba(203,185,148,0.16)', good: '#7FCB9B' },
} as const;

// 글래스 패널 공통 토큰
export const GLASS = {
  panel: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.14)',
  blur: 'blur(10px)',
} as const;

export const tone = (t: BrandTone = 'gold') => TONE[t];
