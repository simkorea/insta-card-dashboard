'use client';

import type { SlideBlock } from '@/lib/cardnews/blocks';
import { readCardBlocks } from '@/lib/cardnews/readCardBlocks';

// 임팩트 스타일 카드 — 어두운 바탕에 포인트 색 하나, 큰 글자로 멈춰 세우는 상담 유입용.
//
// 노트(HybridRenderer)·신문(NewspaperRenderer)과 같은 규약이다:
//   - 글자도 배경도 전부 CSS. AI 호출 0회, 숫자는 진짜 텍스트라 대조가 필요 없다.
//   - 좌표/폰트는 420px 폭 캔버스 기준, scale로 실제 폭에 맞춘다.
//   - blocks 해석은 readCardBlocks 를 공유한다. 여기서 문구를 새로 만들지 않는다.
//
// 장 종류는 내용으로 가른다. 첫 장이거나 표·항목이 없으면 표지형(큰 제목 한 방),
// 나머지는 본문형(제목 + 표 + 번호 목록).
// 글꼴은 CaptureSheet 가 이미 불러오는 Black Han Sans / Noto Sans KR 만 쓴다.

const BG = '#0f1218';
const INK = '#f6f1e4';
const GOLD = '#f2c230';
const MUTE = '#9aa0ad';
const LINE = '#2b303b';

const HEAD = "'Black Han Sans', 'Noto Sans KR', sans-serif";
const BODY = "'Noto Sans KR', sans-serif";

// 제목 길이에 따른 글자 크기. 렌더러가 글자를 재서 줄이는 방식은 폰트가 오기 전
// 값이 굳는 사고가 있었다(HybridRenderer 주석). 여기는 글자 수로 정해 그런 일이 없다.
function coverSize(len: number) {
  return len <= 8 ? 80 : len <= 12 ? 64 : len <= 18 ? 54 : len <= 30 ? 44 : 38;
}
function bodySize(len: number) {
  return len <= 14 ? 34 : len <= 22 ? 29 : 25;
}

export function ImpactRenderer({
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
  const px = (v: number) => `${Math.max(1, s(v))}px`;

  const f = readCardBlocks(blocks, index);
  const tag = f.bandText || noteLabel || '';
  const counter = noteNumber || '';
  const cover = index === 0 || (f.rows.length === 0 && f.points.length === 0);

  // 마지막 어절을 포인트 색 상자로 눌러 준다 — 표지에서 한 단어가 눈에 걸리게.
  const words = f.headline.split(/\s+/).filter(Boolean);
  const lead = words.length > 1 ? words.slice(0, -1).join(' ') : '';
  const accent = words.length > 1 ? words[words.length - 1] : f.headline;

  const rows = f.rows.slice(0, 4);
  // 본문이 빽빽하면 글자를 줄이고 목록도 3개로 자른다 (표 + 목록이 같이 오는 단지 카드).
  // 안 자르면 마지막 줄이 바닥의 출처 문구에 닿는다.
  const dense = rows.length + Math.min(f.points.length, 4) >= 6;
  const points = f.points.slice(0, dense ? 3 : 4);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: BG,
        color: INK,
        fontFamily: BODY,
        overflow: 'hidden',
      }}
    >
      {/* 머리: 분야명 + 번호 */}
      <div
        style={{
          position: 'absolute',
          left: s(30),
          right: s(30),
          top: s(28),
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: s(12),
          letterSpacing: s(2),
          fontWeight: 700,
        }}
      >
        <span style={{ color: GOLD }}>{tag}</span>
        <span style={{ color: MUTE, letterSpacing: 0, fontWeight: 400 }}>{counter}</span>
      </div>

      {cover ? (
        <div style={{ position: 'absolute', left: s(30), right: s(30), top: s(70), bottom: s(70), display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {lead && (
            <div
              style={{
                fontFamily: HEAD,
                fontSize: s(coverSize(f.headline.length)),
                lineHeight: 1.12,
                letterSpacing: s(-0.5),
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
              }}
            >
              {lead}
            </div>
          )}
          <div style={{ marginTop: s(lead ? 8 : 0) }}>
            <span
              style={{
                fontFamily: HEAD,
                fontSize: s(coverSize(f.headline.length)),
                lineHeight: 1.12,
                letterSpacing: s(-0.5),
                background: GOLD,
                color: '#111',
                padding: `0 ${s(8)}px`,
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
                // 두 줄로 접혀도 상자가 줄마다 따로 칠해지게
                boxDecorationBreak: 'clone',
                WebkitBoxDecorationBreak: 'clone',
              }}
            >
              {accent}
            </span>
          </div>
          {f.sub && (
            <div
              style={{
                marginTop: s(22),
                fontSize: s(17),
                lineHeight: 1.5,
                color: MUTE,
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
              }}
            >
              {f.sub}
            </div>
          )}
          <div style={{ position: 'absolute', left: 0, bottom: 0, width: s(64), height: s(6), background: GOLD }} />
        </div>
      ) : (
        <div style={{ position: 'absolute', left: s(30), right: s(30), top: s(70), bottom: s(58), overflow: 'hidden' }}>
          <div
            style={{
              fontFamily: HEAD,
              fontSize: s(bodySize(f.headline.length) * (dense ? 0.9 : 1)),
              lineHeight: 1.2,
              letterSpacing: s(-0.5),
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
            }}
          >
            {f.headline}
          </div>
          {f.sub && (
            <div
              style={{
                marginTop: s(10),
                fontSize: s(dense ? 13 : 15),
                lineHeight: 1.45,
                color: MUTE,
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
              }}
            >
              {f.sub}
            </div>
          )}

          {/* 표: 라벨은 작게, 값은 크게. 강조 줄만 포인트 색 */}
          {rows.length > 0 && (
            <div style={{ marginTop: s(dense ? 10 : 16) }}>
              {rows.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: s(12),
                    padding: `${s(dense ? 4 : 9)}px 0`,
                    borderBottom: `${px(1)} solid ${LINE}`,
                  }}
                >
                  <span style={{ flex: `0 0 ${s(78)}px`, fontSize: s(12), color: MUTE, wordBreak: 'keep-all' }}>
                    {r.label}
                  </span>
                  <span
                    style={{
                      fontSize: s(r.highlight ? 24 : 18),
                      fontWeight: 700,
                      color: r.highlight ? GOLD : INK,
                      wordBreak: 'keep-all',
                      overflowWrap: 'break-word',
                      minWidth: 0,
                    }}
                  >
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 번호 목록: 큰 숫자가 훑어보는 눈을 잡는다 */}
          {points.length > 0 && (
            <ol style={{ listStyle: 'none', margin: `${s(rows.length ? (dense ? 8 : 12) : 18)}px 0 0`, padding: 0 }}>
              {points.map((p, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: s(16),
                    padding: `${s(dense ? 4 : 11)}px 0`,
                    borderBottom: `${px(1)} solid ${LINE}`,
                  }}
                >
                  <b
                    style={{
                      fontFamily: HEAD,
                      fontWeight: 400,
                      fontSize: s(dense ? 26 : 40),
                      lineHeight: 1,
                      color: GOLD,
                      flex: `0 0 ${s(34)}px`,
                    }}
                  >
                    {i + 1}
                  </b>
                  <span
                    style={{
                      fontSize: s(dense ? 16 : 21),
                      fontWeight: 700,
                      lineHeight: 1.3,
                      wordBreak: 'keep-all',
                      overflowWrap: 'break-word',
                      minWidth: 0,
                    }}
                  >
                    {p}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* 바닥: 출처 */}
      {f.source && (
        <div style={{ position: 'absolute', left: s(30), right: s(30), bottom: s(24), fontSize: s(10), color: MUTE }}>
          {f.source}
        </div>
      )}
    </div>
  );
}
