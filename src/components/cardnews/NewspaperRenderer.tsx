'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { SlideBlock } from '@/lib/cardnews/blocks';
import { readCardBlocks } from '@/lib/cardnews/readCardBlocks';
import { pickPaperCut, paperCutUrl } from '@/lib/cardnews/penSketch';

// 신문 지면 스타일 카드 — 글자도 배경도 전부 CSS다. AI 호출 0회.
//
// 왜 신문은 종이 사진이 필요 없나: 노트 스타일은 손글씨 필압과 종이 결이
// 핵심이라 사진 자산을 썼지만, 신문은 '인쇄된 활자와 정확한 괘선'이 전부다.
// 그건 브라우저가 오히려 더 정확하게 그린다. 종이 결만 옅게 깔면 된다.
//
// 지면처럼 보이게 하는 장치들. 그냥 위아래로 쌓으면 보고서로 보인다:
//   빨간 섹션 탭 · 이중 괘선 · 킥커 · 리드 첫 어절 강조 · 대표 수치 상자 ·
//   캡션 달린 삽화 컷 · 하단 folio
//
// 좌표/폰트는 420px 폭 캔버스 기준. scale로 실제 폭에 맞춘다
// (HybridRenderer와 같은 규약).

const PAPER = '#F2EEE3';
const INK = '#15150F';
const RED = '#A81E12';
const MUTED = '#6E6E60';

const HEAD = "'Black Han Sans', 'Noto Sans KR', sans-serif";
const SERIF = "'Nanum Myeongjo', serif";
const BODY = "'Gothic A1', 'Noto Sans KR', sans-serif";

export function NewspaperRenderer({
  blocks,
  scale = 1,
  index = 0,
  noteLabel,
  noteNumber,
}: {
  blocks: SlideBlock[];
  scale?: number;   // 실제 캔버스 폭 / 420
  index?: number;
  noteLabel?: string;
  noteNumber?: string;
}) {
  const s = (v: number) => v * scale;
  const px = (v: number) => `${Math.max(1, s(v))}px`;   // 괘선은 1px 밑으로 내려가면 사라진다
  const rule = (w: number) => ({ height: px(w), background: INK, flexShrink: 0 } as const);

  const f = readCardBlocks(blocks, index);
  const cut = paperCutUrl(pickPaperCut(f.sketchText, index));
  const section = f.bandText || noteLabel || '부동산';

  // 대표 수치는 표에서 꺼내 따로 상자에 앉힌다. 표 한 줄로 두면
  // 정작 기사의 핵심인 숫자가 다른 항목과 같은 무게로 묻힌다.
  const statRow = f.rows.find(r => r.highlight);
  const tableRows = f.rows.filter(r => r !== statRow).slice(0, 4);

  // 빽빽한 장(표와 항목이 다 있는 단지 카드)은 리드를 두 줄로 줄인다.
  // 안 그러면 아래 요소가 카드 밖으로 밀린다.
  const dense = f.hasTable && f.points.length >= 3;
  const points = f.points.slice(0, dense ? 3 : 4);

  // 제목은 기사마다 길이가 제각각이라 고정 크기로는 잘리거나 남는다.
  const titleRef = useRef<HTMLDivElement>(null);
  const MAX = 37;
  const LINE = 1.13;
  const [size, setSize] = useState(MAX);
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    let n = MAX;
    el.style.fontSize = `${s(n)}px`;
    while (n > 15 && el.scrollHeight > s(n) * LINE * 3 + 2) {
      n -= 1;
      el.style.fontSize = `${s(n)}px`;
    }
    setSize(n);
  }, [f.headline, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  // 삽화 컷은 남는 공간을 받는다. 카드마다 내용 길이가 달라 그 공간이
  // 얼마나 될지는 그려봐야 안다 — 실제 높이를 재서 컷과 캡션을 켠다.
  const cutRef = useRef<HTMLDivElement>(null);
  const [cutH, setCutH] = useState(0);
  useLayoutEffect(() => {
    const el = cutRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCutH(el.clientHeight));
    ro.observe(el);
    setCutH(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  const showCut = cutH >= s(46);
  const showCaption = cutH >= s(78);

  // 리드 첫 어절만 굵게. 드롭캡(첫 글자만 크게)은 한글에서 "전 / 남광주",
  // "8 / /7"처럼 낱말을 쪼개 오타로 읽혀서 쓰지 않는다.
  const leadCut = f.sub.indexOf(' ');
  const leadHead = leadCut > 0 && leadCut <= 7 ? f.sub.slice(0, leadCut) : '';
  const leadBody = leadHead ? f.sub.slice(leadCut) : f.sub;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: PAPER,
        // 신문 용지 결 — 아주 옅은 가로 섬유와 얼룩. 사진 자산 없이 CSS로만.
        backgroundImage:
          `repeating-linear-gradient(0deg, rgba(21,21,15,0.02) 0 1px, transparent 1px ${Math.max(2, s(3))}px),` +
          `radial-gradient(120% 80% at 12% 0%, rgba(120,100,60,0.07), transparent 62%),` +
          `radial-gradient(100% 70% at 92% 100%, rgba(120,100,60,0.05), transparent 55%)`,
        color: INK,
        fontFamily: BODY,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: `${s(14)}px ${s(18)}px ${s(11)}px`,
      }}
    >
      {/* ── 제호: 빨간 섹션 탭 + 호수, 아래로 이중 괘선 ── */}
      <div style={rule(4)} />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          margin: `${s(4)}px 0`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            background: RED,
            color: '#fff',
            fontFamily: HEAD,
            fontSize: s(13),
            letterSpacing: s(1.5),
            padding: `${s(2)}px ${s(8)}px ${s(3)}px`,
          }}
        >
          {section}
        </span>
        {noteNumber && (
          <span style={{ fontSize: s(10.5), letterSpacing: s(1.6), color: MUTED }}>
            제 {noteNumber.replace(/^No\./i, '')} 호
          </span>
        )}
      </div>
      <div style={rule(1)} />
      <div style={{ height: px(2), flexShrink: 0 }} />
      <div style={rule(1)} />

      {/* ── 킥커 ── */}
      {f.source && (
        <div
          style={{
            fontSize: s(9.5),
            letterSpacing: s(2.4),
            color: RED,
            fontWeight: 800,
            marginTop: s(9),
            flexShrink: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {f.source.replace(/^출처\s*[:：]\s*/, '')}
        </div>
      )}

      {/* ── 제목 ── */}
      {f.headline && (
        <div
          ref={titleRef}
          style={{
            fontFamily: HEAD,
            fontSize: s(size),
            lineHeight: LINE,
            letterSpacing: s(-1.5),
            // keep-all만 두면 띄어쓰기 없는 긴 단지명이 줄바꿈을 못 해 잘려나가고,
            // anywhere만 두면 "뉴스 8 / 선"처럼 낱말 한가운데가 끊긴다. 둘을 같이 준다.
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            marginTop: s(4),
            flexShrink: 0,
          }}
        >
          {f.headline}
        </div>
      )}

      {/* ── 리드: 첫 어절 강조 + 명조 ── */}
      {f.sub && (
        <>
          <div style={{ ...rule(1), marginTop: s(8) }} />
          <div
            style={{
              fontFamily: SERIF,
              fontSize: s(13),
              lineHeight: 1.6,
              color: '#33332B',
              marginTop: s(6),
              wordBreak: 'keep-all',
              maxHeight: s(13) * 1.6 * (dense ? 2 : 3),
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {leadHead && (
              <span style={{ fontFamily: HEAD, color: RED, fontSize: s(14.5), letterSpacing: s(-0.3) }}>
                {leadHead}
              </span>
            )}
            {leadBody}
          </div>
        </>
      )}

      {/* ── 대표 수치 상자 ── */}
      {statRow && (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: s(9),
            border: `${px(1.5)} solid ${INK}`,
            background: 'rgba(168,30,18,0.05)',
            padding: `${s(6)}px ${s(10)}px ${s(7)}px`,
            marginTop: s(10),
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: HEAD,
              fontSize: s(26),
              color: RED,
              letterSpacing: s(-1),
              lineHeight: 1.05,
              wordBreak: 'keep-all',
            }}
          >
            {statRow.value}
          </span>
          {statRow.label && (
            <span style={{ fontSize: s(11), color: MUTED, letterSpacing: s(0.4), wordBreak: 'keep-all' }}>
              {statRow.label}
            </span>
          )}
        </div>
      )}

      {/* ── 표 ── */}
      {tableRows.length > 0 && (
        <div style={{ marginTop: s(9), borderTop: `${px(1.5)} solid ${INK}`, flexShrink: 0 }}>
          {tableRows.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: s(9),
                padding: `${s(4)}px ${s(2)}px`,
                borderBottom: `${px(1)} solid rgba(21,21,15,0.18)`,
              }}
            >
              <span
                style={{
                  fontSize: s(11),
                  color: MUTED,
                  letterSpacing: s(0.4),
                  flex: `0 0 ${s(62)}px`,
                  lineHeight: 1.3,
                  wordBreak: 'keep-all',
                }}
              >
                {r.label}
              </span>
              <span style={{ fontSize: s(14.5), fontWeight: 700, wordBreak: 'keep-all', lineHeight: 1.3 }}>
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── 핵심 ── */}
      {points.length > 0 && (
        <div style={{ marginTop: s(11), flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: s(6), marginBottom: s(5) }}>
            <span style={{ width: s(8), height: s(8), background: RED, flexShrink: 0 }} />
            <span style={{ fontFamily: HEAD, fontSize: s(14), letterSpacing: s(1) }}>
              {f.hasTable ? '이 단지의 장점' : '핵심 정리'}
            </span>
            <span style={{ flex: 1, height: px(1), background: 'rgba(21,21,15,0.28)' }} />
          </div>
          {points.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: s(7), alignItems: 'baseline', padding: `${s(2)}px 0` }}>
              <span style={{ fontFamily: HEAD, fontSize: s(12), color: RED, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: s(14), lineHeight: 1.4, wordBreak: 'keep-all' }}>{p}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── 삽화 컷: 남는 공간을 받아 지면을 채운다 ──
          신문 전용 가로형 판화 컷을 쓴다. 예전에는 노트용 파란 볼펜 스케치를
          흑백으로 돌려 썼는데, 정사각형이라 이 상자에서 우표만 하게 보였다. */}
      <div
        ref={cutRef}
        style={{ flex: 1, minHeight: 0, marginTop: s(9), display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {showCut && (
          <>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                border: `${px(1)} solid rgba(21,21,15,0.45)`,
                background: 'rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: s(5),
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cut}
                alt=""
                crossOrigin="anonymous"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  // 컷 자산은 이미 검은 잉크 판화라 색을 뺄 필요가 없다.
                  // 곱하기만 걸어 종이 결이 비치게 한다.
                  mixBlendMode: 'multiply',
                }}
              />
            </div>
            {showCaption && (
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: s(9.5),
                  color: MUTED,
                  padding: `${s(3)}px 0`,
                  borderBottom: `${px(1)} solid rgba(21,21,15,0.25)`,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flexShrink: 0,
                }}
              >
                ▲ {f.headline}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── folio ── */}
      <div style={{ ...rule(2), marginTop: s(7) }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: s(8),
          paddingTop: s(3),
          fontSize: s(9.5),
          color: MUTED,
          flexShrink: 0,
        }}
      >
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {f.source}
        </span>
        {/* 제호에 이미 같은 말이 있으면 두 번 찍지 않는다 */}
        {noteLabel && noteLabel !== section && (
          <span style={{ letterSpacing: s(1.2), flexShrink: 0 }}>{noteLabel}</span>
        )}
      </div>
    </div>
  );
}
