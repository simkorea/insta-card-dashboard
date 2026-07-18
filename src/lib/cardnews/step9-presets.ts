export type PresetId = 'trust' | 'impact' | 'info' | 'soft';

export interface Step9Preset {
  id: PresetId;
  label: string;
  desc: string;
  titleFont: string;
  titleWeight: string;
  titleLetterSpacing: number;
  bodyFont: string;
  accent: string;
  accentOverride: string;
  brandTone: 'gold' | 'sage';
  titleFontSize: number;
  subtitleFontSize: number;
  bulletFontSize: number;
  bulletLineHeight: number;
}

export const STEP9_PRESETS: Record<string, Step9Preset> = {
  trust: {
    id: 'trust',
    label: '신뢰·전문',
    desc: '부동산·정책·분양',
    titleFont: 'Noto Sans KR',
    titleWeight: '900',
    titleLetterSpacing: -0.5,
    bodyFont: 'Noto Sans KR',
    accent: '#E9B949',
    accentOverride: '#E9B949',
    brandTone: 'gold',
    titleFontSize: 32,
    subtitleFontSize: 15,
    bulletFontSize: 16,
    bulletLineHeight: 1.5,
  },
  impact: {
    id: 'impact',
    label: '강렬·후킹',
    desc: '이슈·속보·시선끌기',
    titleFont: 'Black Han Sans',
    titleWeight: '400',
    titleLetterSpacing: 0,
    bodyFont: 'Noto Sans KR',
    accent: '#E9B949',
    accentOverride: '#E9B949',
    brandTone: 'gold',
    titleFontSize: 36,
    subtitleFontSize: 15,
    bulletFontSize: 16,
    bulletLineHeight: 1.5,
  },
  info: {
    id: 'info',
    label: '정보·신뢰',
    desc: '통계·제도·해설',
    titleFont: 'Gothic A1',
    titleWeight: '700',
    titleLetterSpacing: 0,
    bodyFont: 'Gothic A1',
    accent: '#6BA6FF',
    accentOverride: '#6BA6FF',
    brandTone: 'gold',
    titleFontSize: 32,
    subtitleFontSize: 15,
    bulletFontSize: 16,
    bulletLineHeight: 1.5,
  },
  soft: {
    id: 'soft',
    label: '부드러움',
    desc: '라이프·웰니스',
    titleFont: 'Gowun Dodum',
    titleWeight: '700',
    titleLetterSpacing: 0,
    bodyFont: 'Noto Sans KR',
    accent: '#CBB994',
    accentOverride: '#CBB994',
    brandTone: 'sage',
    titleFontSize: 32,
    subtitleFontSize: 15,
    bulletFontSize: 16,
    bulletLineHeight: 1.6,
  },
};

export function recommendPreset(category: string): PresetId {
  const cat = (category || '').trim();
  if (cat === '부동산' || cat === '경제') return 'trust';
  if (cat === '마케팅') return 'impact';
  if (cat === '기술') return 'info';
  if (cat === '자기계발' || cat === '라이프스타일') return 'soft';
  return 'trust';
}
