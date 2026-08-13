'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

const RED = '#c8261f';
const INK = '#111';
const FONT = "'Jua', 'Do Hyeon', 'Noto Sans KR', sans-serif";

const PAPER_URL = '/notebook-assets/paper/paper-spring.png';

// 종이 사진에 찍힌 스프링 제본 링이 차지하는 폭 (420px 캔버스 기준).
// 눈대중이 아니라 이미지 픽셀을 훑어 잰 값이다 — 어두운 금속 픽셀이
// 이미지 폭의 16.9%까지 나온다. 종이를 바꾸면 이 값도 다시 재야 한다.
const SPRING_W = 71;

// 펜 그림은 카드 왼쪽 아래 같은 자리에 같은 크기로 놓는다.
// 크기까지 고정해야 여러 장을 넘길 때 그림이 커졌다 작아졌다 하지 않는다.
const SKETCH_W = 134;
const SKETCH_H = 88;
const SKETCH_BOTTOM = 10;
// PNG 사방에 흰 여백이 넓어 상자 크기만큼 안 보인다. 조금 키워 밀어낸다.
const SKETCH_ZOOM = 1.15;

// 지면 아래를 가로로 채우는 도시 풍경이 차지하는 높이.
// 본문은 여기까지만 내려온다.
const BAND_H = 124;

/**
 * 노란 형광펜. 곱하기로 얹어야 종이 결이 비쳐 진짜 마커처럼 보인다.
 *
 * 두 줄로 넘어갈 수 있는 글(체크리스트)에는 flow=true 를 준다. 덧대는 방식은
 * 박스 하나를 통째로 칠하므로, 줄바꿈되면 첫 줄 뒤 빈 공간까지 노랗게 찬다.
 * flow 쪽은 배경 그라디언트라 줄을 따라 자연스럽게 끊긴다.
 */
function Mark({ children, s, flow, color }: { children: React.ReactNode; s: (v: number) => number; flow?: boolean; color?: string }) {
  if (flow) {
    const c = color || 'rgba(255,230,74,0.85)';
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

/**
 * 지면 아래를 가로로 채우는 도시 풍경.
 *
 * AI가 통째로 그리던 카드(7/31~8/4)는 아래를 이런 스카이라인으로 마무리했고,
 * 그게 카드 인상의 큰 부분이었다. 같은 그림을 AI 자산으로 뽑으려 했지만
 * ① 월 한도에 걸려 못 뽑고 ② 뽑아도 간판에 글자가 섞여 나오는 사고가 반복됐다.
 *
 * 건물과 나무는 직선과 원이라 코드로 그리는 편이 낫다 — 돈이 안 들고,
 * 글자가 섞일 일이 없고, 어떤 배율에서도 선이 깨지지 않는다.
 * (주제별 띠그림 자산은 gen-notebook-assets.mjs 의 band: 로 따로 준비해 뒀다.)
 */
// 건물은 오른쪽에만 세운다.
//
// 왼쪽 아래에는 그 장을 가리키는 펜 그림(계약서·열쇠·아파트…)이 놓인다.
// 처음에는 스카이라인을 폭 전체에 깔고 그림을 그 위에 얹었는데, 서로 다른
// 두 손그림이 포개져 선이 엉켰다 — 특히 그림이 건물일 때 어느 쪽 창문인지
// 알아볼 수 없었다. 겹치지 않게 자리를 갈라 놓는다.
const TOWERS: [number, number, number][] = [
  // [왼쪽 x, 폭, 높이] — 높이를 일부러 들쭉날쭉하게 둔다
  [252, 46, 54], [304, 34, 82], [344, 54, 42], [404, 40, 96], [450, 50, 64],
  [506, 36, 48], [548, 58, 86], [612, 44, 58], [662, 34, 50],
];
const TREES: [number, number][] = [[292, 13], [438, 12], [540, 11], [648, 12]];

function SkylineBand({ s }: { s: (v: number) => number }) {
  const BLUE = '#4a5eae';
  const GROUND = 140;
  return (
    <svg
      viewBox="0 0 700 150"
      preserveAspectRatio="none"
      fill="none"
      stroke={BLUE}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        position: 'absolute',
        left: s(SPRING_W),
        right: 0,
        bottom: 0,
        height: s(BAND_H),
        width: `calc(100% - ${s(SPRING_W)}px)`,
        // 배경이지 주인공이 아니다. 본문 글씨보다 앞으로 나오면 안 된다
        opacity: 0.62,
        mixBlendMode: 'multiply',
      }}
    >
      {TOWERS.map(([x, w, h], i) => {
        const y = GROUND - h;
        // 창문 격자 — 층과 칸 수를 건물 크기에서 뽑는다
        const cols = Math.max(2, Math.round(w / 16));
        const rowsN = Math.max(2, Math.round(h / 18));
        const cw = w / (cols * 2 + 1);
        const ch = h / (rowsN * 2 + 1);
        const win = [];
        for (let r = 0; r < rowsN; r++) {
          for (let c = 0; c < cols; c++) {
            win.push(
              <rect
                key={`${r}-${c}`}
                x={x + cw * (c * 2 + 1)}
                y={y + ch * (r * 2 + 1)}
                width={cw}
                height={ch}
                strokeWidth="1.4"
              />
            );
          }
        }
        return (
          <g key={i}>
            <path d={`M${x} ${GROUND} V${y} H${x + w} V${GROUND}`} />
            {win}
          </g>
        );
      })}

      {TREES.map(([x, r], i) => (
        <g key={`t${i}`}>
          <path d={`M${x} ${GROUND} V${GROUND - r * 1.5}`} />
          <circle cx={x} cy={GROUND - r * 2.1} r={r} />
        </g>
      ))}

      {/* 구름 — 위쪽 여백이 허전하지 않게 몇 점만. 건물과 같이 오른쪽에 둔다 */}
      <path d="M300 30 a11 11 0 0 1 21 -4 a9 9 0 0 1 15 4 z" strokeWidth="1.8" />
      <path d="M470 22 a10 10 0 0 1 19 -3 a8 8 0 0 1 13 3 z" strokeWidth="1.8" />
      <path d="M600 40 a9 9 0 0 1 17 -3 a7 7 0 0 1 12 3 z" strokeWidth="1.8" />

      <path d={`M0 ${GROUND} H700`} strokeWidth="2.4" />
    </svg>
  );
}

/**
 * 표 항목 왼쪽 아이콘.
 * 이모지가 아니라 직접 그린다 — 이모지는 기기마다 모양이 달라지고,
 * 캡처하면 흑백으로 빠지는 환경도 있다.
 * 흑백 선화였다가 색을 넣었다. 참고한 노트 카드들은 아이콘마다 색이
 * 달라서 표가 한눈에 구분된다.
 */
function RowIcon({ kind, size }: { kind: string; size: number }) {
  const box = { width: size, height: size, flex: `0 0 ${size}px` };
  if (!kind) return <span style={box} />;
  const common = { ...box, viewBox: '0 0 40 40', strokeWidth: 2.4, strokeLinejoin: 'round' as const };

  if (kind === 'won') {
    return (
      <svg {...common} fill="none">
        <circle cx="20" cy="20" r="15" fill="#1f9d55" stroke="#177a41" />
        <text x="20" y="27" textAnchor="middle" fontSize="19" fill="#fff" fontFamily="sans-serif">₩</text>
      </svg>
    );
  }
  if (kind === 'house') {
    return (
      <svg {...common} fill="none" stroke="#c8261f">
        <path d="M5 19 L20 7 L35 19" fill="#f6c6c1" />
        <path d="M9 18 V34 H31 V18 Z" fill="#fff" />
        <path d="M17 34 V25 H23 V34" />
      </svg>
    );
  }
  if (kind === 'calendar') {
    return (
      <svg {...common} fill="none" stroke="#2f6fb3">
        <rect x="6" y="9" width="28" height="26" rx="3" fill="#fff" />
        <path d="M6 17 H34" stroke="#2f6fb3" strokeWidth="4" />
        <path d="M14 5 V12 M26 5 V12" />
      </svg>
    );
  }
  if (kind === 'people') {
    return (
      <svg {...common} fill="none" stroke="#2f6fb3">
        <circle cx="14" cy="14" r="5" fill="#cfe0f2" />
        <circle cx="27" cy="16" r="4" fill="#cfe0f2" />
        <path d="M5 33 C 5 25, 23 25, 23 33" />
        <path d="M23 33 C 23 27, 35 27, 35 33" />
      </svg>
    );
  }
  if (kind === 'subway') {
    return (
      <svg {...common} fill="none" stroke="#2f6fb3">
        <rect x="9" y="6" width="22" height="22" rx="4" fill="#cfe0f2" />
        <path d="M11 16 H29" />
        <circle cx="14" cy="23" r="1.8" fill="#2f6fb3" stroke="none" />
        <circle cx="26" cy="23" r="1.8" fill="#2f6fb3" stroke="none" />
        <path d="M13 28 L9 35 M27 28 L31 35" />
      </svg>
    );
  }
  // 위치 핀
  return (
    <svg {...common} fill="none" stroke="#c8261f">
      <path d="M20 36 C 20 36, 32 24, 32 16 A 12 12 0 1 0 8 16 C 8 24, 20 36, 20 36 Z" fill="#c8261f" stroke="#9c1d15" />
      <circle cx="20" cy="16" r="4.6" fill="#fff" stroke="none" />
    </svg>
  );
}

// 라벨만 보면 "5대 은행 평균"의 '평'이 평형으로 걸린다. 값까지 같이 본다.
function iconFor(label: string, value = ''): string {
  const t = `${label} ${value}`;
  if (/가격|시세|실거래|매매|전세|분양가|금액|억|만 ?원|₩/.test(t)) return 'won';
  if (/평형|전용|면적|타입|구조|\d+\s*평(?!균)/.test(t)) return 'house';
  if (/날짜|연식|거래일|계약|준공|입주|시점|기간|\d{4}[.년]/.test(t)) return 'calendar';
  if (/세대|가구|규모/.test(t)) return 'people';
  if (/역세권|지하철|노선|호선|역$|교통/.test(t)) return 'subway';
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
  // 참고한 노트 카드는 위치·역·평형·가격·세대수·연식 여섯 줄을 다 보여준다.
  // 네 줄로 자르면 세대수와 연식이 통째로 날아간다 — 임장에서 실제로 보는 값이다.
  const rows = f.rows.slice(0, 6);
  const bandText = f.bandText || noteLabel || '';

  const sketch = penSketchUrl(pickPenSketch(f.sketchText, index));

  // 담을 내용이 적으면 글씨를 키워 빈 곳을 메운다.
  // 없는 내용을 지어낼 수는 없으니, 있는 글을 크게 써서 채우는 쪽이 맞다.
  // 배수는 세 단계뿐이다 — 카드마다 크기가 제각각이면 넘길 때 어수선하다.
  const bodyCount = rows.length + points.length + (sub ? 1 : 0);
  // 8줄이 넘으면 반대로 줄여야 한다 — 표와 장점이 둘 다 긴 단지 카드는
  // 기본 크기로는 글이 아래로 넘쳐 출처 문구가 그림 위로 밀려났다.
  const z = bodyCount <= 2 ? 1.3 : bodyCount <= 3 ? 1.18 : bodyCount <= 5 ? 1.08
          : bodyCount <= 7 ? 1 : bodyCount <= 9 ? 0.93 : 0.87;

  // 표만 있고 장점 목록이 없는 장(statGrid·timeline이 그렇다)은 글씨를 키워도
  // 아래 절반이 텅 빈다. 이럴 때는 정보 상자가 남는 높이를 먹고 줄 간격을
  // 벌리게 한다 — 테두리가 늘어나는 SVG라 상자만 키워도 모양이 유지된다.
  const growBox = rows.length > 0 && points.length === 0;

  // 메모 하나뿐인 장은 오른쪽 구석의 작은 쪽지로는 지면이 안 찬다. 넓게 편다.
  const onlySub = rows.length === 0 && points.length === 0 && Boolean(sub);

  // 제목은 단지명 길이가 제각각이라 고정 크기로는 잘리거나 남는다.
  // 두 줄 안에 들어갈 때까지 줄인다.
  //
  // '양주옥정신도시대방노블랜드더시그니처'처럼 띄어쓰기가 없는 단지명은
  // keep-all이면 줄바꿈이 아예 안 돼 그대로 잘려나간다 — anywhere여야 한다.
  // useLayoutEffect는 웹폰트가 오기 전에 돈다. 폴백 글꼴(맑은 고딕)은 Jua보다
  // 넓어서, 두 줄에 들어갈 제목이 세 줄로 재어지고 그만큼 글씨가 줄어든 채
  // 굳었다 — 8/4 카드보다 제목이 확연히 작아 보이던 게 이것 때문이다.
  // 폰트가 오면 한 번 더 재도록 신호를 준다.
  //
  // document.fonts.ready 하나로는 부족하다. 그 약속은 "지금 걸려 있는 폰트
  // 로드가 끝나면" 풀리는데, 폰트 <link>를 넣는 쪽도 effect라서 우리가 물어보는
  // 시점에는 걸려 있는 게 없어 곧바로 풀린다. 그래서 폴백 글꼴로 잰 값이
  // 그대로 굳었다 — 새로 연 화면에서 제목이 20px로 나왔다(8/4 카드의 절반).
  // 실제로 폰트가 도착할 때마다 오는 loadingdone까지 같이 듣는다.
  const [fontTick, setFontTick] = useState(0);
  useEffect(() => {
    const fs = document.fonts;
    if (!fs) return;
    let alive = true;
    const bump = () => { if (alive) setFontTick(t => t + 1); };
    fs.addEventListener('loadingdone', bump);
    fs.ready.then(bump).catch(() => {});
    return () => { alive = false; fs.removeEventListener('loadingdone', bump); };
  }, []);

  const titleRef = useRef<HTMLDivElement>(null);
  const MAX_TITLE = Math.round(29 * z);
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
  }, [headline, scale, z, fontTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // 줄 수만 세는 어림 배수(z)로는 넘침을 못 막는다 — '광교중앙역 도보 10분'처럼
  // 한 줄이 두 줄로 접히면 같은 줄 수라도 높이가 달라진다. 실제 높이를 재서
  // 넘치는 만큼만 통째로 줄인다.
  //
  // 무한루프가 안 나는 이유: 이 훅은 blocks/scale이 바뀔 때만 돈다. setFit으로
  // 다시 그려져도 훅이 재실행되지 않으므로 측정 → 반영에서 멈춘다.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const bodyKey = JSON.stringify([rows, points, sub, headline, bandText, source]);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    // 이전 배율을 걷어내고 자연 높이를 잰다.
    // 재던 값을 반드시 되돌려 놓아야 한다 — 배율이 그대로면 setFit이 같은 값을
    // 내놓아 다시 그리지 않고, 재느라 넣은 height:auto가 DOM에 남아
    // 상자가 남는 높이를 못 먹는다.
    const keep = { t: el.style.transform, w: el.style.width, h: el.style.height };
    el.style.transform = 'none';
    el.style.width = '100%';
    el.style.height = 'auto';
    // clientHeight는 padding을 포함하지만 height:100%는 content 높이 기준이다.
    // 이 차이를 빼지 않으면 출처 자리만큼 넘침을 놓쳐 글이 그 위로 내려앉는다.
    const avail = parent.clientHeight - (source ? s(15) : 0);
    const need = el.scrollHeight;
    el.style.transform = keep.t;
    el.style.width = keep.w;
    el.style.height = keep.h;
    setFit(need > avail && avail > 0 ? Math.max(0.7, avail / need) : 1);
  }, [bodyKey, scale, z, titleSize, fontTick]); // eslint-disable-line react-hooks/exhaustive-deps

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
          // 아래쪽은 고정된 그림 자리로 비워둔다
          bottom: s(BAND_H),
          // 출처 문구 자리를 미리 떼어 둔다. 이게 없으면 내용이 많은 장에서
          // 장점 목록이 바닥까지 내려와 출처와 맞붙는다.
          paddingBottom: source ? s(15) : 0,
        }}
      >
        {/* 넘칠 때만 통째로 줄이는 자리. 줄이는 만큼 폭·높이를 키워 두어야
            축소 후의 겉보기 크기가 원래 칸에 딱 맞는다. */}
        <div
          ref={bodyRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: `${100 / fit}%`,
            height: `${100 / fit}%`,
            transform: `scale(${fit})`,
            transformOrigin: 'top left',
          }}
        >
        {/* 번호 동그라미 + 동네명 + 별.
            예전에는 남색 띠였는데, 참고한 노트 카드들은 손으로 그린 동그라미에
            번호를 넣고 동네명에 형광펜을 긋는다. 띠보다 노트에 가깝다. */}
        {(bandText || ribbon) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: s(9), flexShrink: 0 }}>
            <span
              style={{
                width: s(31),
                height: s(31),
                flex: `0 0 ${s(31)}px`,
                border: `${Math.max(1, s(2.4))}px solid ${RED}`,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: s(19),
                color: RED,
                // 손으로 그린 동그라미는 정원이 아니다
                transform: 'rotate(-3deg)',
              }}
            >
              {ribbon}
            </span>
            {/* 분야명은 분홍 형광펜. 본문 체크리스트가 전부 노랑이라 같은 색이면
                머리와 본문이 한 덩어리로 붙어 보인다. AI가 그리던 카드도
                여기만 색을 달리 썼다. 별표는 그 카드에 없던 장식이라 뺐다. */}
            {bandText && (
              <span style={{ fontSize: s(24) }}>
                <Mark s={s} flow color="rgba(255,150,196,0.7)">{bandText}</Mark>
              </span>
            )}
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

        {/* 리드 문장 — 제목 바로 아래, 지면 폭을 그대로 쓴다.
            예전에는 오른쪽 구석의 작은 노란 쪽지에 넣었는데, 그러느라 본문이
            쓸 수 있는 폭이 3분의 2로 줄어 체크리스트 글씨까지 잘게 쪼개졌다.
            AI가 그리던 카드는 이 문장을 제목 아래 한 단락으로 흘린다. */}
        {sub && (
          <div
            style={{
              flexShrink: 0,
              marginTop: s(11),
              // 이 문장뿐인 장은 지면이 비므로 더 키운다
              fontSize: onlySub ? s(23) : s(16 * z),
              lineHeight: 1.45,
              color: '#3b3b33',
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
            }}
          >
            {sub}
          </div>
        )}

        {/* 정보 상자 — 자로 잰 사각형이 아니라 손으로 그린 듯 흔들리는 테두리 */}
        {rows.length > 0 && (
          <div
            style={{
              position: 'relative',
              flex: growBox ? '1 1 0' : '0 0 auto',
              minHeight: 0,
              marginTop: s(7),
              padding: `${s(6)}px ${s(13)}px ${s(5)}px`,
              // 상자가 커진 만큼 줄을 고르게 벌린다 (평소에는 붙여 쓴다)
              display: growBox ? 'flex' : undefined,
              flexDirection: growBox ? 'column' : undefined,
              justifyContent: growBox ? 'space-evenly' : undefined,
            }}
          >
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
                    gap: s(9),
                    fontSize: strong ? s(23 * z) : s(17 * z),
                    padding: `${s(2.5)}px 0`,
                    minWidth: 0,
                    // 항목 사이 점선 — 참고한 카드들이 표를 이렇게 끊는다.
                    // 마지막 줄에는 긋지 않는다
                    borderBottom: i < rows.length - 1
                      ? `${Math.max(1, s(1))}px dashed rgba(17,17,17,0.22)`
                      : undefined,
                  }}
                >
                  <RowIcon kind={kind} size={strong ? s(24 * z) : s(21 * z)} />
                  {/* 아이콘이 붙는 줄(위치·평형·가격…)은 라벨이 없어도 뜻이 통하지만,
                      statGrid의 '건물 수'나 timeline의 '8월 중'은 라벨이 곧 정보다.
                      아이콘이 없는 줄에만 라벨을 앞에 세운다 */}
                  {!strong && !kind && r.label && (
                    <span style={{ fontSize: s(13 * z), color: '#6b6b60', flexShrink: 0, wordBreak: 'keep-all' }}>
                      {r.label}
                    </span>
                  )}
                  {strong ? (
                    <Mark s={s}><span style={{ color: RED }}>{r.value}</span></Mark>
                  ) : (
                    // 역·평형처럼 눈에 걸려야 하는 값에도 형광펜을 긋는다.
                    // 참고 카드는 가격 한 곳만이 아니라 여러 곳을 칠한다.
                    (kind === 'house' || kind === 'subway')
                      ? <span style={{ wordBreak: 'keep-all' }}><Mark s={s} flow>{r.value}</Mark></span>
                      : <span style={{ wordBreak: 'keep-all' }}>{r.value}</span>
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

        {/* 남는 높이를 위아래로 나눠 본문을 가운데 아래쪽으로 내린다.
            내용이 적은 장에서 위쪽만 빽빽하고 아래가 텅 비어 보이던 것을 없앤다.
            빽빽한 장에서는 남는 공간이 0이라 아무 일도 일어나지 않는다. */}
        {!growBox && <div style={{ flex: '1 1 0', minHeight: 0 }} />}

        {/* 핵심 포인트 — 지면 폭을 그대로 쓴다 */}
        <div style={{ marginTop: s(13), flexShrink: 0 }}>
          <div>
            {points.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: s(5) }}>
                  <svg width={s(22)} height={s(22)} viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round">
                    <path d="M3.5 10.5h3.2v10H4.4a.9.9 0 0 1-.9-.9v-9.1z" />
                    <path d="M6.7 10.5 10.8 3.4a1.9 1.9 0 0 1 2.9 1.9l-.9 4.6h4.9a1.9 1.9 0 0 1 1.9 2.3l-1.3 5.8a1.9 1.9 0 0 1-1.9 1.5H6.7z" />
                  </svg>
                  {/* 단지 카드(표가 있는 것)는 '장점', 뉴스 카드는 '핵심 포인트' */}
                  <span style={{ fontSize: s(22 * z), color: RED }}>{f.hasTable ? '장점' : '핵심 포인트'}</span>
                </div>
                {/* 물결 밑줄 — 참고 카드가 '장점' 아래에 긋는 그 선 */}
                <svg viewBox="0 0 186 14" preserveAspectRatio="none" style={{ display: 'block', width: s(96), height: s(7), margin: `-${s(1)}px 0 0 ${s(2)}px` }}>
                  <path d="M3 8 Q 18 1, 33 8 T 63 8 T 93 8 T 123 8 T 153 8 T 183 8"
                        stroke={RED} strokeWidth="4" fill="none" strokeLinecap="round" />
                </svg>
                {/* 폭을 온전히 쓰게 되면서 글씨를 키울 수 있게 됐다.
                    AI가 그리던 카드의 체크리스트가 이만한 크기였다. */}
                <div style={{ marginTop: s(7 * z), display: 'flex', flexDirection: 'column', gap: s(5 * z) }}>
                  {points.map((it, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: s(9), fontSize: s(20.5 * z) }}>
                      <svg width={s(20)} height={s(20)} viewBox="0 0 36 36" fill="none" style={{ flex: `0 0 ${s(20)}px`, marginTop: s(3) }}>
                        <rect x="3" y="5" width="29" height="28" rx="2" stroke={INK} strokeWidth="2.8" />
                        <path d="M8 19 L15 27 L31 4" stroke={RED} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {/* '한강로르지오리버프론트'처럼 띄어쓰기 없는 긴 단지명은
                          keep-all만으로는 줄바꿈이 안 돼 옆 메모를 뚫고 나간다 */}
                      <span style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', lineHeight: 1.25, minWidth: 0 }}>
                        <Mark s={s} flow>{it}</Mark>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>

        {!growBox && <div style={{ flex: '1.3 1 0', minHeight: 0 }} />}

        </div>

        {/* 흐름에서 빼서 바닥에 고정한다 — 위 내용이 길어져도 밀리지 않는다 */}
        {source && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              fontSize: s(10),
              color: '#8A8A7A',
            }}
          >
            {source}
          </div>
        )}
      </div>

      {/* 펜 그림 — 카드 왼쪽 아래 고정.
          예전에는 흐름 안에서 '남는 공간'을 받게 해뒀더니, 내용이 길고 짧음에
          따라 그림이 위아래로 뛰어다녀 카드를 넘길 때 어수선했다.
          자리를 못 박고, 남는 공간은 글자 쪽을 키워 채운다. */}
      <SkylineBand s={s} />

      {/* 주제별 펜 그림 — 도시 풍경 왼쪽에 겹쳐 놓는다.
          띠그림만 있으면 카드마다 아래가 똑같아 보인다. 계약서·열쇠·돈처럼
          그 장의 내용을 가리키는 그림 하나가 앞에 서 있어야 장이 구분된다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sketch}
        alt=""
        crossOrigin="anonymous"
        style={{
          position: 'absolute',
          left: s(SPRING_W + 4),
          bottom: s(SKETCH_BOTTOM),
          width: s(SKETCH_W),
          height: s(SKETCH_H),
          objectFit: 'contain',
          objectPosition: 'left bottom',
          // PNG 사방에 흰 여백이 넓다. 조금 키워 여백을 상자 밖으로 밀어낸다
          transform: `scale(${SKETCH_ZOOM})`,
          transformOrigin: 'left bottom',
          mixBlendMode: 'multiply',
          filter: 'brightness(1.02) contrast(1.5) saturate(1.4)',
        }}
      />

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
