import { tone, GLASS } from '@/lib/cardnews/theme';
import type { SlideBlock, BrandTone } from '@/lib/cardnews/blocks';

const panel = {
  background: GLASS.panel,
  border: `1px solid ${GLASS.border}`,
  backdropFilter: GLASS.blur,
  WebkitBackdropFilter: GLASS.blur,
  borderRadius: 14,
} as const;

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';

export interface TextStyle {
  fontSize?: number;       // px at 420px canvas width
  fontWeight?: string;     // '300'|'400'|'500'|'600'|'900'
  fontFamily?: string;
  color?: string;
  letterSpacing?: number;  // px
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
}

export function BlockRenderer({
  blocks,
  brandTone = 'gold',
  editable = false,
  onBlockOffsetChange,
  availableHeight,
  isDraggingParent = false,
  titleStyle,
  subtitleStyle,
  bulletStyle,
}: {
  blocks: SlideBlock[];
  brandTone?: BrandTone;
  editable?: boolean;
  onBlockOffsetChange?: (index: number, offsetY: number) => void;
  availableHeight?: number;
  isDraggingParent?: boolean;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  bulletStyle?: TextStyle;
}) {
  const c = tone(brandTone);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const dragStartRef = useRef<{ index: number; startY: number; startOffset: number } | null>(null);
  const [hoveredGripIndex, setHoveredGripIndex] = useState<number | null>(null);

  // ── Auto-fit: transform scale down when blocks overflow availableHeight ──
  const outerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const fitScaleRef = useRef(1);

  useLayoutEffect(() => {
    fitScaleRef.current = fitScale;
  }, [fitScale]);

  // Recompute trigger to handle lazy loading (e.g. fonts, layout changes)
  const [recomputeNonce, setRecomputeNonce] = useState(0);
  const triggerRecompute = () => setRecomputeNonce(prev => prev + 1);

  // 1. Core useLayoutEffect for measuring and updating fitScale
  useLayoutEffect(() => {
    if (isDragging || isDraggingParent) return; // Skip updating fitScale while dragging to freeze scale

    const el = outerRef.current;
    if (!el || !availableHeight || availableHeight <= 0) {
      if (fitScale !== 1) {
        setFitScale(1);
      }
      return;
    }

    // Temporarily disable transform to measure absolute unscaled natural height
    const prevTransform = el.style.transform;
    el.style.transform = 'none';

    // Temporarily clear children translateY transforms to prevent measuring height pollution
    const childWrappers = el.querySelectorAll('[data-block-wrapper]') as NodeListOf<HTMLDivElement>;
    const prevChildTransforms: string[] = [];
    childWrappers.forEach((child, idx) => {
      prevChildTransforms[idx] = child.style.transform;
      child.style.transform = 'none';
    });

    const naturalH = el.scrollHeight;

    // Restore children transforms
    childWrappers.forEach((child, idx) => {
      child.style.transform = prevChildTransforms[idx];
    });
    el.style.transform = prevTransform;

    // Minimum scale limit set to 0.55 for absolute safety against overflows
    const newScale = naturalH > availableHeight
      ? Math.max(0.55, availableHeight / naturalH)
      : 1;

    // Diagnostic console logs as requested
    console.log(`[BlockRenderer Diagnosis] recomputeNonce: ${recomputeNonce}`, {
      availableHeight,
      contentHeight: naturalH,
      fitScale: newScale,
      appliedTransformOrigin: 'bottom center',
    });

    if (Math.abs(newScale - fitScale) > 0.005) {
      setFitScale(newScale);
    }
  }, [availableHeight, blocks, recomputeNonce, fitScale]);

  // 2. document.fonts.ready for handling timing issues (Scenario A)
  useEffect(() => {
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        // Trigger a recompute once custom web fonts are fully loaded
        triggerRecompute();
      }).catch(err => {
        console.warn('fonts.ready error:', err);
      });
    }
  }, [availableHeight, blocks]);

  // 3. ResizeObserver to catch any dynamic content dimensions updates (Scenario A)
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      triggerRecompute();
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [availableHeight, blocks]);

  // 4. Drag and Drop Pointer Move Event Listeners
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStartRef.current || !onBlockOffsetChange) return;
      const { index, startY, startOffset } = dragStartRef.current;
      // Divide drag delta by scale so drag handles move 1:1 with user's pointer
      const currentScale = fitScaleRef.current || 1;
      const deltaY = (e.clientY - startY) / currentScale;
      let newOffset = startOffset + deltaY;
      newOffset = Math.max(-300, Math.min(300, newOffset));
      onBlockOffsetChange(index, newOffset);
    };

    const handlePointerUp = () => {
      dragStartRef.current = null;
      setIsDragging(false);
      setActiveDragIndex(null);
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, onBlockOffsetChange]);

  const handleHandlePointerDown = (e: React.PointerEvent, index: number, currentOffset: number) => {
    e.stopPropagation();
    e.preventDefault();
    dragStartRef.current = {
      index,
      startY: e.clientY,
      startOffset: currentOffset,
    };
    setIsDragging(true);
    setActiveDragIndex(index);
    document.body.style.cursor = 'ns-resize';
  };

  return (
    <div
      ref={outerRef}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
        transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
        transformOrigin: 'bottom center',
      }}
    >
      {blocks.map((b, i) => {
        const blockOffsetY = b.offsetY ?? 0;

        // Render block based on type
        let innerContent = null;
        switch (b.type) {
          case 'eyebrow':
            innerContent = (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 4,
                  color: c.accent,
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                {b.text}
              </div>
            );
            break;

          case 'headline':
            innerContent = (
              <div style={{
                fontSize: titleStyle?.fontSize ?? 32,
                fontWeight: titleStyle?.fontWeight ?? '900',
                fontFamily: titleStyle?.fontFamily ?? undefined,
                color: titleStyle?.color ?? '#fff',
                lineHeight: titleStyle?.lineHeight ?? 1.12,
                letterSpacing: titleStyle?.letterSpacing != null ? `${titleStyle.letterSpacing}px` : '-0.5px',
                textAlign: titleStyle?.align ?? undefined,
              }}>
                {b.text}
                {b.accentText && <span style={{ color: c.accent }}> {b.accentText}</span>}
              </div>
            );
            break;

          case 'sub':
            innerContent = (
              <div style={{
                fontSize: subtitleStyle?.fontSize ?? 15,
                fontWeight: subtitleStyle?.fontWeight ?? '400',
                fontFamily: subtitleStyle?.fontFamily ?? undefined,
                color: subtitleStyle?.color ?? 'rgba(255,255,255,0.7)',
                lineHeight: subtitleStyle?.lineHeight ?? 1.4,
                letterSpacing: subtitleStyle?.letterSpacing != null ? `${subtitleStyle.letterSpacing}px` : undefined,
                textAlign: subtitleStyle?.align ?? undefined,
              }}>{b.text}</div>
            );
            break;

          case 'bigNumber':
            innerContent = (
              <div>
                <div style={{ fontSize: 56, fontWeight: 900, color: c.accent, lineHeight: 1, letterSpacing: -1 }}>{b.value}</div>
                {b.caption && (
                  <div style={{
                    fontSize: bulletStyle?.fontSize ?? 14,
                    fontWeight: bulletStyle?.fontWeight ?? '400',
                    fontFamily: bulletStyle?.fontFamily ?? undefined,
                    color: bulletStyle?.color ?? 'rgba(255,255,255,0.65)',
                    lineHeight: bulletStyle?.lineHeight ?? 1.4,
                    letterSpacing: bulletStyle?.letterSpacing != null ? `${bulletStyle.letterSpacing}px` : undefined,
                    textAlign: bulletStyle?.align ?? undefined,
                    marginTop: 6,
                  }}>{b.caption}</div>
                )}
              </div>
            );
            break;

          case 'compareTable':
            innerContent = (
              <div style={{ ...panel, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {b.rows.map((r, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: bulletStyle?.fontSize ?? 15,
                      fontWeight: r.highlight ? 800 : (bulletStyle?.fontWeight ?? '500'),
                      fontFamily: bulletStyle?.fontFamily ?? undefined,
                      color: r.highlight ? '#fff' : (bulletStyle?.color ?? 'rgba(255,255,255,0.75)'),
                      lineHeight: bulletStyle?.lineHeight ?? 1.4,
                      letterSpacing: bulletStyle?.letterSpacing != null ? `${bulletStyle.letterSpacing}px` : undefined,
                    }}>{r.label}</span>
                    <span style={{ fontSize: r.highlight ? 22 : 17, fontWeight: 800, color: r.highlight ? c.accent : '#fff' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            );
            break;

          case 'timeline':
            innerContent = (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {b.items.map((it, j) => {
                  const dot = it.state === 'done' ? c.good : it.state === 'active' ? c.accent : 'rgba(255,255,255,0.35)';
                  return (
                    <div key={j} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 10, height: 10, marginTop: 5, borderRadius: 999, background: dot, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: dot }}>{it.date}</div>
                        <div style={{
                          fontSize: bulletStyle?.fontSize ? bulletStyle.fontSize + 2 : 16,
                          fontWeight: bulletStyle?.fontWeight ?? '700',
                          fontFamily: bulletStyle?.fontFamily ?? undefined,
                          color: bulletStyle?.color ?? '#fff',
                          lineHeight: bulletStyle?.lineHeight ?? 1.4,
                          letterSpacing: bulletStyle?.letterSpacing != null ? `${bulletStyle.letterSpacing}px` : undefined,
                        }}>{it.title}</div>
                        {it.desc && (
                          <div style={{
                            fontSize: bulletStyle?.fontSize ?? 12,
                            fontWeight: bulletStyle?.fontWeight ?? '400',
                            fontFamily: bulletStyle?.fontFamily ?? undefined,
                            color: bulletStyle?.color ?? 'rgba(255,255,255,0.55)',
                            lineHeight: bulletStyle?.lineHeight ?? 1.4,
                            letterSpacing: bulletStyle?.letterSpacing != null ? `${bulletStyle.letterSpacing}px` : undefined,
                          }}>{it.desc}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
            break;

          case 'statGrid':
            innerContent = (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${b.cols ?? 3}, 1fr)`, gap: 10 }}>
                {b.items.map((s, j) => (
                  <div key={j} style={{ ...panel, padding: '16px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: c.accent, lineHeight: 1 }}>{s.value}</div>
                    <div style={{
                      fontSize: bulletStyle?.fontSize ?? 11,
                      fontWeight: bulletStyle?.fontWeight ?? '400',
                      fontFamily: bulletStyle?.fontFamily ?? undefined,
                      color: bulletStyle?.color ?? 'rgba(255,255,255,0.7)',
                      lineHeight: bulletStyle?.lineHeight ?? 1.4,
                      letterSpacing: bulletStyle?.letterSpacing != null ? `${bulletStyle.letterSpacing}px` : undefined,
                      marginTop: 6,
                    }}>{s.label}</div>
                  </div>
                ))}
              </div>
            );
            break;

          case 'checklist':
            innerContent = (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {b.items.map((it, j) => (
                  <div key={j} style={{ ...panel, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: c.good, fontSize: 16, fontWeight: 900, flexShrink: 0 }}>✓</span>
                    <span style={{
                      fontSize: bulletStyle?.fontSize ?? 15,
                      fontWeight: bulletStyle?.fontWeight ?? '600',
                      fontFamily: bulletStyle?.fontFamily ?? undefined,
                      color: bulletStyle?.color ?? '#fff',
                      lineHeight: bulletStyle?.lineHeight ?? 1.35,
                      letterSpacing: bulletStyle?.letterSpacing != null ? `${bulletStyle.letterSpacing}px` : undefined,
                    }}>{it}</span>
                  </div>
                ))}
              </div>
            );
            break;

          case 'badgeRow':
            innerContent = (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {b.badges.map((bd, j) => {
                  const bg = bd.tone === 'green' ? 'rgba(91,208,138,0.16)' : bd.tone === 'neutral' ? 'rgba(255,255,255,0.10)' : c.accentSoft;
                  const fg = bd.tone === 'green' ? c.good : bd.tone === 'neutral' ? 'rgba(255,255,255,0.85)' : c.accent;
                  return (
                    <span key={j} style={{
                      fontSize: bulletStyle?.fontSize ?? 13,
                      fontWeight: bulletStyle?.fontWeight ?? '700',
                      fontFamily: bulletStyle?.fontFamily ?? undefined,
                      color: fg,
                      background: bg,
                      border: `1px solid ${bg}`,
                      padding: '6px 14px',
                      borderRadius: 999,
                      letterSpacing: bulletStyle?.letterSpacing != null ? `${bulletStyle.letterSpacing}px` : undefined,
                    }}>{bd.text}</span>
                  );
                })}
              </div>
            );
            break;

          case 'sourceNote':
            innerContent = (
              <div style={{
                fontSize: bulletStyle?.fontSize ? bulletStyle.fontSize - 4 : 10,
                fontWeight: bulletStyle?.fontWeight ?? '400',
                fontFamily: bulletStyle?.fontFamily ?? undefined,
                color: bulletStyle?.color ?? 'rgba(255,255,255,0.4)',
                letterSpacing: bulletStyle?.letterSpacing != null ? `${bulletStyle.letterSpacing}px` : undefined,
                textAlign: 'center',
              }}>{b.text}</div>
            );
            break;

          default:
            innerContent = null;
            break;
        }

        if (!innerContent) return null;

        const wrapperStyle: React.CSSProperties = {
          position: 'relative',
          transform: `translateY(${blockOffsetY}px)`,
          transition: isDragging && activeDragIndex === i ? 'none' : 'transform 0.1s ease',
        };

        return (
          <div key={i} style={wrapperStyle} data-block-wrapper>
            {innerContent}
            {editable && (
              <div
                onPointerDown={(e) => handleHandlePointerDown(e, i, blockOffsetY)}
                onMouseEnter={() => setHoveredGripIndex(i)}
                onMouseLeave={() => setHoveredGripIndex(null)}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: -24,
                  transform: 'translateY(-50%)',
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: hoveredGripIndex === i ? 'rgba(139, 92, 246, 1.0)' : 'rgba(139, 92, 246, 0.55)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  cursor: 'ns-resize',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                  zIndex: 50,
                  userSelect: 'none',
                  pointerEvents: 'auto',
                  opacity: hoveredGripIndex === i ? 1.0 : 0.55,
                  transition: 'opacity 0.15s ease, background-color 0.15s ease',
                  touchAction: 'none',
                }}
                title="드래그하여 개별 세로 위치 조절 (↕)"
              >
                ↕
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
