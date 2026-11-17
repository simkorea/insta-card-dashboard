'use client';

import { useEffect, useState } from 'react';
import { BlockRenderer } from '@/components/cardnews/BlockRenderer';
import { HybridRenderer } from '@/components/cardnews/HybridRenderer';
import { NewspaperRenderer } from '@/components/cardnews/NewspaperRenderer';
import { ImpactRenderer } from '@/components/cardnews/ImpactRenderer';
import { NotebookRenderer } from '@/components/cardnews/NotebookRenderer';
import { planCaption, type CaptionPlan } from '@/lib/video/caption';

/**
 * 영상 한 장을 그리는 화면.
 *
 * 왜 video-generator 안의 SlideFrame 을 여기로 옮겼나
 *
 * 1) 최신 카드뉴스는 `blocks` 로 저장된다(카드뉴스 편집기·MCP 저장 모두).
 *    영상 쪽 SlideFrame 은 blocks 를 아예 몰라서, blocks 카드를 고르면 제목·불릿이
 *    비어 있는 까만 화면이 나왔다. 배경 사진(photoBg) 카드도 마찬가지였다.
 *    여기서는 서버 캡처(CaptureSheet)와 같은 순서로 그린다 —
 *    사진 배경이 있으면 사진 + 어두운 오버레이 + 글 블록, 없으면 카드 종류별 렌더러.
 *
 * 2) 좌표계를 420×525(4:5) 하나로 고정하고 통째로 scale 한다. 편집기·캡처와 같은
 *    좌표라 글자 크기·여백이 화면과 똑같이 나온다.
 *
 * 3) 쇼츠 모드에서는 '배경'과 '카드'를 따로 그린다. 촬영(내보내기)할 때 배경만
 *    천천히 줌인하고 카드는 고정하면, 글씨는 흔들리지 않고 배경만 살아 움직인다.
 *    아래쪽에는 자막 띠(SHORTS_BAND)를 비워 두어 자막이 카드 본문을 덮지 않는다.
 */

export const CARD_W = 420;
export const CARD_H = 525;
/** 쇼츠 모드에서 아래에 비워 두는 자막 띠 높이 (420 폭 기준 px) */
export const SHORTS_BAND = 156;
/** 4:5·1:1 에서 자막 자리로 비워 두는 높이 (420 폭 기준 px) */
export const FRAME_BAND = 140;
/** 카드가 화면 위아래로 붙지 않게 두는 여백 */
const SHORTS_MARGIN = 18;
const PAPER = '#F3F1EA';
const PHOTO_OVERLAY = 'linear-gradient(to top, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.40) 100%)';

/** 종이·그림 카드 — 카드 한 장이 곧 그림이라 사진 위에 글을 얹는 카드와 다르게 다룬다. */
export function isPosterPage(page: any): boolean {
  if (page?.photoBg) return false;
  const v = page?.styleVariant;
  if (v === 'hybrid' || v === 'hybridPaper' || v === 'impact') return true;
  if ((v === 'image' || v === 'notebook') && page?.bgImage) return true;
  return false;
}

/** 사진을 바탕으로 쓰는 카드인가 (사진 배경 + 오버레이 + 글) */
export function hasPhotoBackdrop(page: any): boolean {
  return Boolean(page?.photoBg || page?.bgImage) && !isPosterPage(page);
}

function WholeImage({ src }: { src: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        crossOrigin="anonymous"
        style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}

/** 카드 한 장(420×525 좌표계). 종이·그림 카드는 part 를 무시하고 통째로 그린다. */
function DesignCard({ page, part, bottomInset = 0, index = 0 }: { page: any; part: 'all' | 'bg' | 'text'; bottomInset?: number; index?: number }) {
  const v = page?.styleVariant;
  const notes = { noteLabel: page?.noteLabel, noteNumber: page?.noteNumber };
  const blocks = page?.blocks || [];

  // ── 카드 한 장이 곧 그림인 경우 ────────────────────────────────
  if (isPosterPage(page)) {
    if (v === 'hybridPaper') return <NewspaperRenderer blocks={blocks} scale={1} index={index} {...notes} />;
    if (v === 'impact') return <ImpactRenderer blocks={blocks} scale={1} index={index} {...notes} />;
    if (v === 'notebook') {
      return blocks.length
        ? <NotebookRenderer blocks={blocks} scale={1} height={CARD_H} {...notes} />
        : <WholeImage src={page.bgImage} />;
    }
    if (v === 'image') return <WholeImage src={page.bgImage} />;
    return <HybridRenderer blocks={blocks} scale={1} index={index} {...notes} />;
  }

  // ── 사진 배경 + 글 ────────────────────────────────────────────
  const photo = page?.photoBg || page?.bgImage;

  return (
    <>
      {part !== 'text' && (
        photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt=""
              crossOrigin="anonymous"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                transform: `scale(${page.bgScale ?? 1})`,
                transformOrigin: `${page.bgPosition?.x ?? 50}% ${page.bgPosition?.y ?? 50}%`,
                filter: `brightness(${(page.bgBrightnessFilter ?? 100) / 100})`,
              }}
            />
            <div
              style={{
                position: 'absolute', inset: 0,
                background: page.overlay || (page.photoBg ? PHOTO_OVERLAY : 'rgba(0,0,0,0.4)'),
                opacity: (page.overlayOpacity ?? 100) / 100,
              }}
            />
            {(page.bgBrightness ?? 0) > 0 && (
              <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${(page.bgBrightness ?? 0) / 100})` }} />
            )}
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: page.overlay || 'rgba(0,0,0,0.45)' }} />
        )
      )}
      {part !== 'bg' && (blocks.length
        ? <BlocksLayer page={page} bottomInset={bottomInset} />
        : <LegacyText page={page} bottomInset={bottomInset} />)}
    </>
  );
}

/**
 * 카드뉴스 blocks — 편집기 CardView / 서버 CaptureSheet 와 같은 자리.
 * BlockRenderer 는 420 좌표 그대로 쓰고, 바깥 상자에서 배율만 준다.
 */
function BlocksLayer({ page, bottomInset = 0 }: { page: any; bottomInset?: number }) {
  const offsetY = page.blocksOffsetY ?? 70;
  // 자막 자리를 비워 둘 때는 글이 그 위에서 끝나게 한다(자막과 겹치지 않게)
  const reserve = Math.min(bottomInset, CARD_H * offsetY / 100 * 0.55);
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: `${100 - offsetY}%`,
        left: 28,
        right: 28,
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 40 + reserve,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: 'auto' }}>
        <BlockRenderer
          blocks={page.blocks}
          brandTone={page.brandTone}
          accentOverride={page.accentOverride}
          availableHeight={Math.max(120, Math.floor((CARD_H * offsetY) / 100 - 40 - reserve))}
          titleStyle={page.titleStyle}
          subtitleStyle={page.subtitleStyle}
          bulletStyle={page.bulletStyle}
        />
      </div>
    </div>
  );
}

/** blocks 이전에 만든 카드 — 제목·부제·불릿·요소. 예전 SlideFrame 그대로(420 좌표). */
function LegacyText({ page, bottomInset = 0 }: { page: any; bottomInset?: number }) {
  const titleSize = page.titleStyle?.fontSize ?? 38;
  const accent = page.accent || '#ffd700';
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {page.layout === 'center' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: `0 40px ${Math.min(bottomInset, 120)}px`, textAlign: 'center' }}>
          {page.title && (
            <h1 style={{
              fontSize: titleSize, fontWeight: page.titleStyle?.fontWeight ?? '900',
              fontFamily: page.titleStyle?.fontFamily ?? 'Noto Sans KR', color: page.titleStyle?.color ?? '#fff',
              lineHeight: 1.2, whiteSpace: 'pre-line', margin: 0, maxWidth: '100%', wordBreak: 'keep-all', overflowWrap: 'break-word',
            }}>{page.title}</h1>
          )}
          {page.subtitle && (
            <p style={{
              fontSize: page.subtitleStyle?.fontSize ?? 14, fontWeight: page.subtitleStyle?.fontWeight ?? '400',
              fontFamily: page.titleStyle?.fontFamily ?? 'Noto Sans KR', color: page.subtitleStyle?.color ?? '#e5e7eb',
              lineHeight: 1.6, whiteSpace: 'pre-line', marginTop: 16, maxWidth: '100%', wordBreak: 'keep-all', overflowWrap: 'break-word',
            }}>{page.subtitle}</p>
          )}
        </div>
      )}
      {(page.layout === 'bottom-left' || page.layout === 'bottom-left-list') && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', padding: `0 32px ${40 + Math.min(bottomInset, 180)}px`, gap: 20 }}>
          {page.title && (
            <h2 style={{
              fontSize: page.titleStyle?.fontSize ?? 24, fontWeight: '900',
              fontFamily: page.titleStyle?.fontFamily ?? 'Noto Sans KR', color: page.titleStyle?.color ?? accent,
              lineHeight: 1.2, margin: 0, maxWidth: '100%', wordBreak: 'keep-all', overflowWrap: 'break-word',
            }}>{page.title}</h2>
          )}
          {page.bullets && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {page.bullets.map((b: string, i: number) => (
                <p
                  key={i}
                  style={{ fontSize: page.bulletStyle?.fontSize ?? 14, color: page.bulletStyle?.color ?? '#fff', lineHeight: 1.6, margin: 0 }}
                  dangerouslySetInnerHTML={{ __html: `• ${b.replace(/<b>(.*?)<\/b>/g, `<b style="color:${accent}">$1</b>`)}` }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {(page.elements || []).map((elem: any) => {
        const pxSize = (elem.size / 100) * CARD_W;
        const textW = elem.type === 'text' ? ((elem.width ?? 80) / 100) * CARD_W : pxSize;
        return (
          <div key={elem.id} style={{ position: 'absolute', left: `${elem.x}%`, top: `${elem.y}%`, width: textW, height: elem.type === 'text' ? 'auto' : pxSize, opacity: elem.opacity, zIndex: 15, transform: 'translate(-50%,-50%)' }}>
            {elem.type === 'emoji' && <span style={{ fontSize: pxSize, lineHeight: 1 }}>{elem.emoji}</span>}
            {elem.type === 'text' && elem.text && (
              <p style={{ fontSize: elem.fontSize ?? 16, fontWeight: elem.fontWeight ?? '400', fontFamily: elem.fontFamily ?? 'Noto Sans KR', textAlign: elem.textAlign ?? 'left', color: elem.color, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{elem.text}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 420×525 카드를 k 배로 키워 frame 안의 (left, top) 에 놓는다. */
function ScaleBox({ k, left, top, children }: { k: number; left: number; top: number; children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', left, top, width: CARD_W * k, height: CARD_H * k }}>
      <div style={{ width: CARD_W, height: CARD_H, transform: `scale(${k})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}

function placeIn(W: number, H: number, fit: 'cover' | 'contain') {
  const k = fit === 'cover' ? Math.max(W / CARD_W, H / CARD_H) : Math.min(W / CARD_W, H / CARD_H);
  return { k, left: (W - CARD_W * k) / 2, top: (H - CARD_H * k) / 2 };
}

/**
 * 미리보기용 자막 — 내보낼 때 캔버스로 그리는 것과 같은 조판(크기·줄바꿈·강조)을 쓴다.
 * 눈으로 본 것과 나오는 영상이 달라지면 안 되므로 글자 폭을 캔버스로 재어 같은 계획을 세운다.
 */
function CaptionPreview({
  text, width, bandH, bottomPad,
}: { text: string; width: number; bandH: number; bottomPad: number }) {
  const s = width / CARD_W;
  const [plan, setPlan] = useState<CaptionPlan | null>(null);

  // 글꼴이 온 뒤에 재야 줄바꿈이 실제 영상과 같아진다.
  // (서버에서는 캔버스가 없으므로 그릴 것도 없다 — 화면에서만 계산한다)
  useEffect(() => {
    let alive = true;
    (async () => {
      try { await document.fonts?.ready; } catch { /* 글꼴 없이도 잰다 */ }
      if (!alive) return;
      if (!text.trim()) { setPlan(null); return; }
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      if (!ctx) { setPlan(null); return; }
      setPlan(planCaption(ctx, text, {
        maxWidth: width - 48 * s,
        baseSize: Math.round((bandH > 0 ? 34 : 30) * s),
        maxLines: 3,
      }));
    })();
    return () => { alive = false; };
  }, [text, width, s, bandH]);

  const seg = plan?.segments[0];
  if (!plan || !seg) return null;

  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, bottom: bottomPad,
        display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none',
      }}
    >
      {seg.lines.map((line, i) => (
        <div
          key={i}
          style={{
            fontSize: plan.size, lineHeight: `${plan.lineHeight}px`, whiteSpace: 'pre',
            fontWeight: 800, fontFamily: '"Noto Sans KR", sans-serif',
            textShadow: '0 2px 10px rgba(0,0,0,0.55)',
          }}
        >
          {line.runs.map((r, j) => (
            <span key={j} style={{ color: r.hl ? '#FFD54A' : '#FFFFFF' }}>{r.text}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export type VideoSlideProps = {
  page: any;
  width: number;
  height: number;
  /** frame = 카드가 화면을 채운다(4:5·1:1), shorts = 9:16 위에 카드를 띄운다 */
  mode: 'frame' | 'shorts';
  /** all=완성 화면, bg=움직이는 배경만, text=고정될 글자만(뒤는 투명) */
  layer?: 'all' | 'bg' | 'fg';
  /** 미리보기에서만 보이는 자막 */
  subtitle?: string;
  /**
   * 자막이 들어가는 영상인가. 쇼츠 모드에서 아래 자막 띠를 비울지 정한다 —
   * 자막이 없는데 비워 두면 카드가 쓸데없이 작아진다.
   */
  captionBand?: boolean;
  /** 몇 번째 장인가 — 종이 카드의 펜 그림·쪽번호가 장마다 달라진다 */
  index?: number;
};

export function VideoSlide({ page, width, height, mode, layer = 'all', subtitle, captionBand = true, index = 0 }: VideoSlideProps) {
  if (!page) return <div style={{ width, height, background: '#111' }} />;

  const poster = isPosterPage(page);

  // ── 쇼츠 모드 ────────────────────────────────────────────────
  if (mode === 'shorts') {
    const s = width / CARD_W;
    const bandH = captionBand ? SHORTS_BAND * s : 0;
    const areaH = height - bandH;
    const m = SHORTS_MARGIN * s;
    const k = Math.min(width / CARD_W, (areaH - m * 2) / CARD_H);
    const cardLeft = (width - CARD_W * k) / 2;
    const cardTop = m + Math.max(0, (areaH - m * 2 - CARD_H * k) / 2);

    const blurredBackdrop = (
      <div style={{ position: 'absolute', inset: -height * 0.04, filter: 'blur(22px) brightness(0.42) saturate(1.05)', transform: 'scale(1.08)' }}>
        {hasPhotoBackdrop(page) ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={page.photoBg || page.bgImage}
            alt=""
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : poster ? (
          <div style={{ position: 'absolute', inset: 0 }}>
            <ScaleBox k={Math.max(width / CARD_W, height / CARD_H)} left={(width - CARD_W * Math.max(width / CARD_W, height / CARD_H)) / 2} top={(height - CARD_H * Math.max(width / CARD_W, height / CARD_H)) / 2}>
              <DesignCard page={page} part="all" index={index} />
            </ScaleBox>
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#14161c' }} />
        )}
      </div>
    );

    if (layer === 'bg') {
      return (
        <div style={{ position: 'relative', width, height, overflow: 'hidden', background: '#0b0b0d' }}>
          {blurredBackdrop}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.78) 100%)' }} />
        </div>
      );
    }

    const card = (
      <div
        style={{
          position: 'absolute', left: cardLeft, top: cardTop, width: CARD_W * k, height: CARD_H * k,
          overflow: 'hidden', borderRadius: 12 * s, boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
        }}
      >
        <ScaleBox k={k} left={0} top={0}>
          <DesignCard page={page} part="all" index={index} />
        </ScaleBox>
      </div>
    );

    if (layer === 'fg') {
      return <div style={{ position: 'relative', width, height, overflow: 'hidden', background: 'transparent' }}>{card}</div>;
    }

    return (
      <div style={{ position: 'relative', width, height, overflow: 'hidden', background: '#0b0b0d' }}>
        {blurredBackdrop}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0) 62%)' }} />
        {card}
        {bandH > 0 && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: bandH, background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 45%, rgba(0,0,0,0.94) 100%)' }} />
        )}
        <CaptionPreview text={subtitle || ''} width={width} bandH={bandH} bottomPad={52 * s} />
      </div>
    );
  }

  // ── 기본(카드가 화면을 채우는) 모드 ───────────────────────────
  //
  // 자막이 들어가면 아래 FRAME_BAND 만큼은 자막 자리로 비워 둔다.
  //   사진 카드 — 사진은 화면을 꽉 채우고(cover) 글자만 그만큼 위로 올린다.
  //              사진을 잘라내지 않으면서 자막과 절대 겹치지 않는다.
  //   종이·그림 카드 — 카드 한 장이 곧 그림이라 통째로 위로 올린다(contain).
  const fs = width / CARD_W;
  const frameBand = captionBand ? FRAME_BAND * fs : 0;
  // 자막 자리를 비울 때는 카드가 위쪽에 떠 있는 그림이 되므로 숨 쉴 여백을 준다
  const framePad = frameBand > 0 ? 18 * fs : 0;
  const geo = poster
    ? (() => { const g = placeIn(width, height - frameBand - framePad * 2, 'contain'); return { ...g, top: g.top + framePad }; })()
    : placeIn(width, height, 'cover');

  if (layer === 'bg') {
    return (
      <div style={{ position: 'relative', width, height, overflow: 'hidden', background: 'transparent' }}>
        <ScaleBox k={geo.k} left={geo.left} top={geo.top}>
          <DesignCard page={page} part="bg" index={index} />
        </ScaleBox>
      </div>
    );
  }

  if (layer === 'fg') {
    return (
      <div style={{ position: 'relative', width, height, overflow: 'hidden', background: 'transparent' }}>
        <ScaleBox k={geo.k} left={geo.left} top={geo.top}>
          <DesignCard page={page} part="text" index={index} bottomInset={poster ? 0 : frameBand / geo.k} />
        </ScaleBox>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden', flexShrink: 0, background: poster ? (frameBand > 0 ? '#0b0b0d' : PAPER) : '#111' }}>
      <ScaleBox k={geo.k} left={geo.left} top={geo.top}>
        <DesignCard page={page} part="all" index={index} bottomInset={poster ? 0 : frameBand / geo.k} />
      </ScaleBox>
      {subtitle ? (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.max(frameBand, height * 0.24), background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 55%, rgba(0,0,0,0.94) 100%)' }} />
          <CaptionPreview text={subtitle} width={width} bandH={0} bottomPad={26 * fs} />
        </>
      ) : null}
    </div>
  );
}
