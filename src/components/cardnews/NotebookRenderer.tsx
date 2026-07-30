import React from 'react';
import type { SlideBlock } from '@/lib/cardnews/blocks';

// 손글씨 노트 스타일 카드 렌더러.
//
// 기존 BlockRenderer(다크 글래스모피즘)는 건드리지 않고 별도 컴포넌트로 둔다.
// PageData.styleVariant === 'notebook' 일 때만 이 렌더러가 쓰인다.
// 같은 SlideBlock[] 데이터를 받으므로 생성 로직은 공유된다.
//
// 좌표/폰트 크기는 모두 420px 폭 캔버스 기준. scale로 실제 폭에 맞춘다.

const PAPER = '#FBF6E9';
const INK = '#2B2B2B';
const RED = '#E23B2E';
const BLUE = '#2F6FB3';
const HIGHLIGHT = 'rgba(255, 226, 84, 0.75)';

// 손글씨 느낌 폰트 — 이미 프로젝트에서 쓰는 구글 폰트 조합 안에서 고른다
const HAND = "'Gaegu', 'Gowun Dodum', 'Noto Sans KR', sans-serif";
const HAND_BOLD = "'Gaegu', 'Black Han Sans', 'Noto Sans KR', sans-serif";

function Highlighted({ children, color = HIGHLIGHT }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        background: `linear-gradient(to top, ${color} 0%, ${color} 45%, transparent 46%)`,
        padding: '0 2px',
      }}
    >
      {children}
    </span>
  );
}

// 스프링 제본 구멍
function Spiral({ height, scale }: { height: number; scale: number }) {
  const count = Math.max(6, Math.floor(height / (34 * scale)));
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 26 * scale,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingTop: 10 * scale,
        paddingBottom: 10 * scale,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 15 * scale,
            height: 15 * scale,
            borderRadius: '50%',
            background: '#3A3A3A',
            boxShadow: `inset 0 ${1.5 * scale}px ${2 * scale}px rgba(255,255,255,0.35)`,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

export function NotebookRenderer({
  blocks,
  scale = 1,
  height,
  noteLabel,
  noteNumber,
}: {
  blocks: SlideBlock[];
  scale?: number;      // 실제 캔버스 폭 / 420
  height?: number;     // 스프링 개수 계산용 (px)
  noteLabel?: string;  // 우하단 배지 윗줄 (예: "임장노트")
  noteNumber?: string; // 우하단 배지 아랫줄 (예: "No.006")
}) {
  const s = (v: number) => v * scale;

  const eyebrow = blocks.find(b => b.type === 'eyebrow') as { text: string } | undefined;
  const headline = blocks.find(b => b.type === 'headline') as { text: string; accentText?: string } | undefined;
  const sub = blocks.find(b => b.type === 'sub') as { text: string } | undefined;
  const bigNumber = blocks.find(b => b.type === 'bigNumber') as { value: string; caption?: string } | undefined;
  const stat = blocks.find(b => b.type === 'statGrid') as { items: { value: string; label: string }[] } | undefined;
  const table = blocks.find(b => b.type === 'compareTable') as { rows: { label: string; value: string; highlight?: boolean }[] } | undefined;
  const checklist = blocks.find(b => b.type === 'checklist') as { items: string[] } | undefined;
  const badges = blocks.find(b => b.type === 'badgeRow') as { badges: { text: string }[] } | undefined;
  const source = blocks.find(b => b.type === 'sourceNote') as { text: string } | undefined;
  const timeline = blocks.find(b => b.type === 'timeline') as { items: { date: string; title: string; desc?: string }[] } | undefined;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: PAPER,
        // 노트 줄 + 왼쪽 여백선
        backgroundImage: `repeating-linear-gradient(transparent, transparent ${s(29)}px, rgba(120,140,170,0.22) ${s(29)}px, rgba(120,140,170,0.22) ${s(30)}px)`,
        color: INK,
        fontFamily: HAND,
        overflow: 'hidden',
      }}
    >
      <Spiral height={height ?? s(525)} scale={scale} />

      {/* 왼쪽 빨간 여백선 */}
      <div
        style={{
          position: 'absolute',
          left: s(44),
          top: 0,
          bottom: 0,
          width: Math.max(1, s(1.5)),
          background: 'rgba(226,59,46,0.35)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: s(56),
          right: s(20),
          top: s(24),
          bottom: s(20),
          display: 'flex',
          flexDirection: 'column',
          gap: s(10),
        }}
      >
        {/* 번호 + 분야 라벨 */}
        {eyebrow?.text && (
          <div style={{ fontSize: s(24), fontWeight: 700, fontFamily: HAND_BOLD, color: INK, lineHeight: 1.1 }}>
            <Highlighted>{eyebrow.text}</Highlighted>
            <span style={{ color: RED, marginLeft: s(6) }}>☆</span>
          </div>
        )}

        {/* 제목 + 빨간 밑줄 */}
        {headline?.text && (
          <div>
            <div
              style={{
                fontSize: s(33),
                fontWeight: 800,
                fontFamily: HAND_BOLD,
                lineHeight: 1.15,
                letterSpacing: s(-0.5),
              }}
            >
              {headline.text}
              {headline.accentText && <span style={{ color: RED }}> {headline.accentText}</span>}
            </div>
            <div
              style={{
                height: s(3),
                width: '72%',
                marginTop: s(4),
                background: RED,
                borderRadius: s(2),
                opacity: 0.85,
              }}
            />
          </div>
        )}

        {sub?.text && (
          <div style={{ fontSize: s(15), lineHeight: 1.45, color: '#4A4A4A' }}>{sub.text}</div>
        )}

        {/* 대표 수치 */}
        {bigNumber?.value && (
          <div
            style={{
              border: `${Math.max(1, s(2))}px solid ${BLUE}`,
              borderRadius: s(8),
              padding: `${s(8)}px ${s(12)}px`,
              alignSelf: 'flex-start',
            }}
          >
            <div style={{ fontSize: s(38), fontWeight: 800, fontFamily: HAND_BOLD, color: RED, lineHeight: 1 }}>
              {bigNumber.value}
            </div>
            {bigNumber.caption && (
              <div style={{ fontSize: s(13), color: '#555', marginTop: s(3) }}>{bigNumber.caption}</div>
            )}
          </div>
        )}

        {/* 통계 — 손글씨 박스 나열 */}
        {stat?.items?.length ? (
          <div style={{ display: 'flex', gap: s(8), flexWrap: 'wrap' }}>
            {stat.items.slice(0, 3).map((it, i) => (
              <div
                key={i}
                style={{
                  border: `${Math.max(1, s(2))}px solid ${BLUE}`,
                  borderRadius: s(8),
                  padding: `${s(6)}px ${s(10)}px`,
                  textAlign: 'center',
                  minWidth: s(88),
                }}
              >
                <div style={{ fontSize: s(22), fontWeight: 800, color: RED, fontFamily: HAND_BOLD, lineHeight: 1.1 }}>
                  {it.value}
                </div>
                <div style={{ fontSize: s(12), color: '#555' }}>{it.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* 정보표 — 레퍼런스의 위치·역·평형·가격 표 */}
        {table?.rows?.length ? (
          <div
            style={{
              border: `${Math.max(1, s(1.5))}px solid #8A8A7A`,
              borderRadius: s(6),
              padding: `${s(8)}px ${s(10)}px`,
              display: 'flex',
              flexDirection: 'column',
              gap: s(5),
              background: 'rgba(255,255,255,0.45)',
            }}
          >
            {table.rows.slice(0, 6).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: s(8) }}>
                <span style={{ fontSize: s(14), color: '#666', minWidth: s(58), flexShrink: 0 }}>{r.label}</span>
                <span style={{ fontSize: s(17), fontWeight: 700, color: r.highlight ? RED : INK }}>
                  {r.highlight ? <Highlighted>{r.value}</Highlighted> : r.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {/* 일정 */}
        {timeline?.items?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: s(6) }}>
            {timeline.items.slice(0, 4).map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: s(8), alignItems: 'baseline' }}>
                <span style={{ fontSize: s(13), fontWeight: 700, color: BLUE, minWidth: s(62), flexShrink: 0 }}>
                  {it.date}
                </span>
                <span style={{ fontSize: s(16), fontWeight: 700 }}>{it.title}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* 장점 체크리스트 — 카드의 본문 */}
        {checklist?.items?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: s(9) }}>
            <div style={{ fontSize: s(20), fontWeight: 800, fontFamily: HAND_BOLD }}>
              👍 <Highlighted>핵심 포인트</Highlighted>
            </div>
            {checklist.items.slice(0, 5).map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: s(8), alignItems: 'flex-start' }}>
                <span style={{ color: RED, fontSize: s(17), fontWeight: 800, lineHeight: 1.3, flexShrink: 0 }}>☑</span>
                <span style={{ fontSize: s(17), fontWeight: 600, lineHeight: 1.35 }}>
                  <Highlighted>{it}</Highlighted>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {/* 배지 */}
        {badges?.badges?.length ? (
          <div style={{ display: 'flex', gap: s(6), flexWrap: 'wrap' }}>
            {badges.badges.slice(0, 4).map((b, i) => (
              <span
                key={i}
                style={{
                  fontSize: s(14),
                  fontWeight: 700,
                  color: INK,
                  border: `${Math.max(1, s(1.5))}px solid ${RED}`,
                  borderRadius: s(999),
                  padding: `${s(4)}px ${s(11)}px`,
                  background: 'rgba(255,226,84,0.35)',
                }}
              >
                {b.text}
              </span>
            ))}
          </div>
        ) : null}

        <div style={{ flex: 1 }} />

        {source?.text && (
          <div style={{ fontSize: s(11), color: '#8A8A7A' }}>{source.text}</div>
        )}
      </div>

      {/* 우하단 임장노트 배지 */}
      {(noteLabel || noteNumber) && (
        <div
          style={{
            position: 'absolute',
            right: s(16),
            bottom: s(16),
            background: '#E8DCC0',
            border: `${Math.max(1, s(1))}px solid #C9B78F`,
            padding: `${s(6)}px ${s(12)}px`,
            transform: 'rotate(-2deg)',
            textAlign: 'center',
            boxShadow: `0 ${s(2)}px ${s(5)}px rgba(0,0,0,0.14)`,
          }}
        >
          {noteLabel && <div style={{ fontSize: s(11), color: '#6B5B3E' }}>{noteLabel}</div>}
          {noteNumber && (
            <div style={{ fontSize: s(19), fontWeight: 800, fontFamily: HAND_BOLD, color: RED, lineHeight: 1.1 }}>
              {noteNumber}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
