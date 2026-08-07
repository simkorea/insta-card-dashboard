'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import type { SlideBlock } from '@/lib/cardnews/blocks';
import { readCardBlocks } from '@/lib/cardnews/readCardBlocks';
import { pickPenSketch, penSketchUrl } from '@/lib/cardnews/penSketch';

// 하이브리드 카드 렌더러 — 종이·펜 그림만 AI로 미리 뽑아두고, 글자는 CSS로 조판한다.
//
// 왜 이렇게 하는가:
//   1) 돈. 카드 한 장을 통째로 AI에게 그리게 하면 장당 ₩270이 든다.
//      여기서는 자산이 정적 파일이라 카드당 AI 호출이 0회다.
//   2) 정확성. 시세를 다루는 계정에서 숫자를 이미지 모델이 그리면 틀릴 수 있어
//      매번 비전 모델로 대조해야 했다. 글자가 진짜 텍스트면 대조가 필요 없다.
//   3) 수정. AI 카드는 오타 하나에 다시 그려야 하지만 여기는 글자만 고치면 된다.
//
// 좌표/폰트는 전부 420px 폭 캔버스 기준. scale로 실제 폭에 맞춘다
// (NotebookRenderer와 같은 규약).

const NAVY = '#2b3a5e';
const RED = '#c8261f';
const INK = '#111';
const FONT = "'Jua', 'Do Hyeon', 'Noto Sans KR', sans-serif";

const PAPER_URL = '/notebook-assets/paper/paper-spring.png';

// 종이 사진에 찍힌 스프링 제본 링이 차지하는 폭 (420px 캔버스 기준).
// 눈대중이 아니라 이미지 픽셀을 훑어 잰 값이다 — 어두운 금속 픽셀이
// 이미지 폭의 16.9%까지 나온다. 종이를 바꾸면 이 값도 다시 재야 한다.
const SPRING_W = 71;

/**
 * 노란 형광펜. 곱하기로 얹어야 종이 결이 비쳐 진짜 마커처럼 보인다.
 *
 * 두 줄로 넘어갈 수 있는 글(체크리스트)에는 flow=true 를 준다. 덧대는 방식은
 * 박스 하나를 통째로 칠하므로, 줄바꿈되면 첫 줄 뒤 빈 공간까지 노랗게 찬다.
 * flow 쪽은 배경 그라디언트라 줄을 따라 자연스럽게 끊긴다.
 */
function Mark({ children, s, flow }: { children: React.ReactNode; s: (v: number) => number; flow?: boolean }) {
  if (flow) {
    const c = 'rgba(255,230,74,0.85)';
    return (
      <span style={{ background: `linear-gradient(to top, ${c} 0%, ${c} 78%, transparent 79%)`, padding: `0 ${s(2)}px` }}>
        {children}
      </span>
    );
  }
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span
        style={{
          position: 'absolute',
          left: -s(5),
          right: -s(7),
          top: '18%',
          bottom: '4%',
          background: '#ffe64a',
          mixBlendMode: 'multiply',
          transform: 'rotate(-0.7deg)',
          clipPath: 'polygon(1% 12%, 99% 0, 100% 88%, 0 100%)',
        }}
      />
      <span style={{ position: 'relative' }}>{children}</span>
    </span>
  );
}

/** 표 항목 왼쪽 아이콘 — 이모지 대신 선화를 직접 그린다 */
function RowIcon({ kind, size }: { kind: string; size: number }) {
  if (!kind) return <span style={{ width: size, height: size, flex: `0 0 ${size}px` }} />;
  const common = {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
    viewBox: '0 0 40 40',
    fill: 'none' as const,
    stroke: INK,
    strokeWidth: 2.6,
  };
  if (kind === 'won') {
    return (
      <span style={{ width: size, height: size, flex: `0 0 ${size}px`, color: RED, fontSize: size, lineHeight: 1, textAlign: 'center' }}>
        ₩
      </span>
    );
  }
  if (kind === 'house') {
    return (
      <svg {...common} strokeLinejoin="round">
        <path d="M5 19 L20 7 L35 19" /><path d="M9 18 V34 H31 V18" /><path d="M17 34 V25 H23 V34" />
      </svg>
    );
  }
  if (kind === 'calendar') {
    return (
      <svg {...common}>
        <rect x="6" y="9" width="28" height="26" rx="3" /><path d="M6 17 H34" /><path d="M14 5 V12 M26 5 V12" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M20 36 C 20 36, 32 24, 32 16 A 12 12 0 1 0 8 16 C 8 24, 20 36, 20 36 Z" />
      <circle cx="20" cy="16" r="4.6" />
    </svg>
  );
}

// 라벨만 보면 "5대 은행 평균"의 '평'이 평형으로 걸린다. 값까지 같이 본다.
function iconFor(label: string, value = ''): string {
  const t = `${label} ${value}`;
  if (/가격|시세|실거래|매매|전세|분양가|금액|억|만 ?원|₩/.test(t)) return 'won';
  if (/평형|전용|면적|타입|구조|\d+\s*평(?!균)/.test(t)) return 'house';
  if (/날짜|연식|거래일|계약|준공|입주|시점|기간|\d{4}[.년]/.test(t)) return 'calendar';
  if (/위치|주소|지역|동네|소재/.test(t)) return 'pin';
  return '';
}

export function HybridRenderer({
  blocks,
  scale = 1,
  index = 0,
  noteLabel,
  noteNumber,
  paperUrl = PAPER_URL,
}: {
  blocks: SlideBlock[];
  scale?: number;     // 실제 캔버스 폭 / 420
  index?: number;     // 스케치를 돌려 쓰기 위한 카드 순번
  noteLabel?: string;
  noteNumber?: string;
  paperUrl?: string;
}) {
  const s = (v: number) => v * scale;

  // 블록 해석은 신문 렌더러와 공유한다 — 각자 하면 한쪽만 고쳐져 어긋난다
  const f = readCardBlocks(blocks, index);
  const { headline, sub, points, source, ribbon } = f;
  const rows = f.rows.slice(0, 4);
  const bandText = f.bandText || noteLabel || '';

  const sketch = penSketchUrl(pickPenSketch(f.sketchText, index));

  // 제목은 단지명 길이가 제각각이라 고정 크기로는 잘리거나 남는다.
  // 두 줄 안에 들어갈 때까지 줄인다.
  //
  // '양주옥정신도시대방노블랜드더시그니처'처럼 띄어쓰기가 없는 단지명은
  // keep-all이면 줄바꿈이 아예 안 돼 그대로 잘려나간다 — anywhere여야 한다.
  const titleRef = useRef<HTMLDivElement>(null);
  const MAX_TITLE = 29;
  const LINE = 1.08;
  const [titleSize, setTitleSize] = useState(MAX_TITLE);
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    let size = MAX_TITLE;
    el.style.fontSize = `${s(size)}px`;
    while (size > 12 && el.scrollHeight > s(size) * LINE * 2 + 2) {
      size -= 1;
      el.style.fontSize = `${s(size)}px`;
    }
    setTitleSize(size);
  }, [headline, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `#FBF6E9 url('${paperUrl}') center/cover no-repeat`,
        fontFamily: FONT,
        color: INK,
        overflow: 'hidden',
      }}
    >
      {/* 스프링은 종이 사진에 이미 찍혀 있다 — 글은 그 오른쪽에만.
          paper-spring.png의 제본 링은 폭의 16.9%까지 뻗는다(420px 기준 71px).
          예전 값 56px은 링 위로 글씨가 15px 올라타 겹쳐 보였다. */}
      <div
        style={{
          position: 'absolute',
          left: s(SPRING_W + 7),
          right: s(14),
          top: s(13),
          bottom: s(10),
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 남색 띠 + 번호 리본 */}
        {(bandText || ribbon) && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              style={{
                height: s(37),
                background: NAVY,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // 손으로 칠한 듯 위아래 가장자리를 흐트러뜨린다
                clipPath: 'polygon(0 9%, 18% 2%, 52% 6%, 86% 1%, 100% 8%, 100% 92%, 64% 99%, 26% 94%, 0 100%)',
              }}
            >
              <span style={{ fontSize: s(21), color: '#fff', letterSpacing: s(1.5) }}>{bandText}</span>
            </div>
            <div
              style={{
                position: 'absolute',
                right: s(3),
                top: -s(10),
                width: s(44),
                height: s(56),
                background: NAVY,
                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)',
                display: 'flex',
                justifyContent: 'center',
                paddingTop: s(7),
              }}
            >
              <span style={{ fontSize: s(22), color: '#fff' }}>{ribbon}</span>
            </div>
          </div>
        )}

        {/* 제목 + 손으로 그은 빨간 밑줄 */}
        {headline && (
          <div style={{ flexShrink: 0, marginTop: s(10) }}>
            <div
              ref={titleRef}
              style={{
                fontSize: s(titleSize),
                lineHeight: LINE,
                letterSpacing: s(-1.5),
                // keep-all만 두면 띄어쓰기 없는 긴 단지명이 줄바꿈을 못 해 잘려나가고,
                // anywhere만 두면 "뉴스 8 / 선"처럼 낱말 한가운데가 끊긴다. 둘을 같이 준다.
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
              }}
            >
              {headline}
            </div>
            <svg
              viewBox="0 0 700 16"
              preserveAspectRatio="none"
              style={{ display: 'block', width: '97%', height: s(8), marginTop: s(1) }}
            >
              <path d="M4 8 C 180 2, 340 13, 696 6" stroke={RED} strokeWidth="7" fill="none" strokeLinecap="round" />
              <path d="M12 13 C 200 8, 360 16, 668 11" stroke={RED} strokeWidth="3" fill="none" strokeLinecap="round" opacity=".45" />
            </svg>
          </div>
        )}

        {/* 정보 상자 — 자로 잰 사각형이 아니라 손으로 그린 듯 흔들리는 테두리 */}
        {rows.length > 0 && (
          <div style={{ position: 'relative', flexShrink: 0, marginTop: s(7), padding: `${s(8)}px ${s(13)}px ${s(7)}px` }}>
            <svg
              viewBox="0 0 690 250"
              preserveAspectRatio="none"
              fill="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            >
              <path
                d="M6 10 C 240 4, 460 14, 684 7 C 688 90, 686 170, 683 243 C 450 249, 240 240, 8 246 C 3 165, 5 88, 6 10 Z"
                stroke={INK}
                strokeWidth="4"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {rows.map((r, i) => {
              const kind = iconFor(r.label || '', r.value || '');
              const strong = Boolean(r.highlight) || kind === 'won';
              return (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: s(8),
                    fontSize: strong ? s(23) : s(17),
                    padding: `${s(2)}px 0`,
                    minWidth: 0,
                  }}
                >
                  <RowIcon kind={kind} size={strong ? s(23) : s(20)} />
                  {strong ? (
                    <Mark s={s}><span style={{ color: RED }}>{r.value}</span></Mark>
                  ) : (
                    <span style={{ wordBreak: 'keep-all' }}>{r.value}</span>
                  )}
                  {/* 강조 줄은 값만 크게 보여주므로 무엇의 값인지 작게 덧붙인다 */}
                  {strong && r.label && (
                    <span style={{ fontSize: s(12), color: '#6b6b60', wordBreak: 'keep-all' }}>{r.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 장점 + 메모를 좌우로 — 항목이 늘어도 메모와 겹치지 않는다 */}
        <div style={{ display: 'flex', gap: s(10), marginTop: s(11), alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {points.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: s(5) }}>
                  <svg width={s(22)} height={s(22)} viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round">
                    <path d="M3.5 10.5h3.2v10H4.4a.9.9 0 0 1-.9-.9v-9.1z" />
                    <path d="M6.7 10.5 10.8 3.4a1.9 1.9 0 0 1 2.9 1.9l-.9 4.6h4.9a1.9 1.9 0 0 1 1.9 2.3l-1.3 5.8a1.9 1.9 0 0 1-1.9 1.5H6.7z" />
                  </svg>
                  {/* 단지 카드(표가 있는 것)는 '장점', 뉴스 카드는 '핵심 포인트' */}
                  <span style={{ fontSize: s(22), color: RED }}>{f.hasTable ? '장점' : '핵심 포인트'}</span>
                </div>
                <svg viewBox="0 0 186 12" preserveAspectRatio="none" style={{ display: 'block', width: s(93), height: s(6), margin: `-${s(1)}px 0 0 ${s(2)}px` }}>
                  <path d="M4 7 C 54 2, 128 11, 182 5" stroke={RED} strokeWidth="6" fill="none" strokeLinecap="round" />
                </svg>
                <div style={{ marginTop: s(5), display: 'flex', flexDirection: 'column', gap: s(3) }}>
                  {points.map((it, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: s(8), fontSize: s(18) }}>
                      <svg width={s(18)} height={s(18)} viewBox="0 0 36 36" fill="none" style={{ flex: `0 0 ${s(18)}px`, marginTop: s(2) }}>
                        <rect x="3" y="5" width="29" height="28" rx="2" stroke={INK} strokeWidth="2.8" />
                        <path d="M8 19 L15 27 L31 4" stroke={RED} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span style={{ wordBreak: 'keep-all', lineHeight: 1.25 }}>
                        <Mark s={s} flow>{it}</Mark>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 포스트잇 — 테이프로 붙인 메모 */}
          {sub && (
            <div
              style={{
                position: 'relative',
                flex: `0 0 ${s(133)}px`,
                padding: `${s(13)}px ${s(10)}px ${s(12)}px`,
                background: 'linear-gradient(165deg, #fff4a3, #ffec78)',
                transform: 'rotate(1.6deg)',
                boxShadow: `${s(2)}px ${s(3.5)}px ${s(8)}px rgba(0,0,0,.22)`,
                marginTop: s(4),
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -s(8),
                  right: s(13),
                  width: s(56),
                  height: s(17),
                  background: 'rgba(226,214,178,.85)',
                  transform: 'rotate(-7deg)',
                  boxShadow: `0 ${s(0.5)}px ${s(1.5)}px rgba(0,0,0,.16)`,
                }}
              />
              {/* 오른쪽 아래 태그에 이미 noteLabel이 있다 — 여기까지 같은 말을 쓰면 두 번 찍힌다 */}
              <div style={{ fontSize: s(17), textAlign: 'center' }}>메모</div>
              <div style={{ height: s(2), background: INK, margin: `${s(1)}px ${s(17)}px ${s(6)}px` }} />
              <div style={{ fontSize: s(13.5), lineHeight: 1.42, textAlign: 'center', wordBreak: 'keep-all' }}>{sub}</div>
            </div>
          )}
        </div>

        {/* 펜 그림 — 남는 공간을 채운다. 내용이 길면 알아서 작아진다 */}
        <div style={{ position: 'relative', flex: 1, minHeight: s(95), marginTop: s(4) }}>
          {/* next/image가 아니라 순수 img여야 한다 — html-to-image로 카드를 캡처한다 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sketch}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: 'absolute',
              // 스케치 PNG는 사방에 흰 여백이 있어 살짝 왼쪽으로 당겨야 제자리로 보인다.
              // 다만 스프링까지 넘어가면 안 된다.
              left: -s(5),
              bottom: 0,
              // 내용이 적은 장(표지 등)에서는 그림이 커져 아래 여백을 채운다.
              // 빽빽한 장에서는 높이가 먼저 걸려 알아서 작아진다.
              maxWidth: s(290),
              // 아래로 넘치면 바로 밑의 출처 문구를 덮는다
              maxHeight: '100%',
              mixBlendMode: 'multiply',
              filter: 'brightness(1.02) contrast(1.5) saturate(1.4)',
            }}
          />
        </div>

        {source && (
          <div style={{ fontSize: s(10), color: '#8A8A7A', flexShrink: 0 }}>{source}</div>
        )}
      </div>

      {/* 끈에 매단 크라프트 태그 */}
      {(noteLabel || noteNumber) && (
        <>
          <svg
            viewBox="0 0 120 90"
            fill="none"
            style={{ position: 'absolute', right: s(125), bottom: s(75), width: s(60), height: s(45) }}
          >
            <path d="M4 4 C 40 16, 70 40, 112 62" stroke="#a98a63" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <div
            style={{
              position: 'absolute',
              right: s(17),
              bottom: s(18),
              width: s(131),
              padding: `${s(9)}px 0 ${s(11)}px`,
              background: 'linear-gradient(170deg, #d6b78e, #c39a6b)',
              textAlign: 'center',
              transform: 'rotate(-4deg)',
              boxShadow: `${s(2)}px ${s(3.5)}px ${s(8)}px rgba(0,0,0,.26)`,
              clipPath: 'polygon(11% 0, 100% 0, 100% 100%, 11% 100%, 0 50%)',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: s(13),
                top: '50%',
                transform: 'translateY(-50%)',
                width: s(9.5),
                height: s(9.5),
                borderRadius: '50%',
                background: '#7a6247',
                boxShadow: `inset ${s(0.5)}px ${s(0.5)}px ${s(1)}px rgba(0,0,0,.5)`,
              }}
            />
            {noteLabel && <div style={{ fontSize: s(16.5) }}>{noteLabel}</div>}
            {noteNumber && <div style={{ fontSize: s(24), color: RED, marginTop: s(1) }}>{noteNumber}</div>}
          </div>
        </>
      )}
    </div>
  );
}
