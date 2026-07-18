import { tone } from '@/lib/cardnews/theme';
import type { BrandTone } from '@/lib/cardnews/blocks';

export function SlideFrame({
  handle = '@aptshowhome',
  page,
  total,
  brandTone = 'gold',
  accentOverride,
  eyebrow,
  children,
}: {
  handle?: string;
  page?: number;
  total?: number;
  brandTone?: BrandTone;
  accentOverride?: string;
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  const base = tone(brandTone);
  const isHex6 = typeof accentOverride === 'string' && /^#[0-9A-Fa-f]{6}$/.test(accentOverride);
  const c = accentOverride
    ? {
        ...base,
        accent: accentOverride,
        accentSoft: isHex6 ? `${accentOverride}29` : base.accentSoft,
      }
    : base;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* 상단: 핸들 pill + 페이지번호 */}
      <div style={{ position: 'absolute', top: 18, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: c.accent, border: `1px solid ${c.accentSoft}`, background: 'rgba(0,0,0,0.35)', padding: '4px 12px', borderRadius: 999 }}>{handle}</span>
        {page != null && total != null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>{page} / {total}</span>
        )}
      </div>

      {/* 섹션 라벨(eyebrow) */}
      {eyebrow && (
        <div style={{ position: 'absolute', top: 64, left: 0, right: 0, textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 4, color: c.accent, zIndex: 12 }}>
          {eyebrow.toUpperCase()}
        </div>
      )}

      {/* 본문 슬롯 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 11 }}>{children}</div>

      {/* 하단 액센트 바 */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: `linear-gradient(90deg, ${c.accent}, transparent)`, zIndex: 12 }} />
    </div>
  );
}
