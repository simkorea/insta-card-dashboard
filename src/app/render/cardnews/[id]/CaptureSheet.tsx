'use client';

import { useEffect, useState } from 'react';
import { HybridRenderer } from '@/components/cardnews/HybridRenderer';
import { NewspaperRenderer } from '@/components/cardnews/NewspaperRenderer';
import { ImpactRenderer } from '@/components/cardnews/ImpactRenderer';
import { BlockRenderer } from '@/components/cardnews/BlockRenderer';

// 서버(헤드리스 크롬)가 카드를 캡처할 화면.
//
// 화면에서 예약할 때 쓰는 BulkScheduleBar 의 캡처 영역과 같은 크기·같은
// 렌더러를 쓴다. 다르게 그리면 자동으로 올라간 카드만 모양이 달라진다.
// 화면(에디터)과 똑같이 1배로 그린다.
//
// 처음엔 예약 화면처럼 scale 2.6 으로 크게 그렸는데, 그러면 제목이 오른쪽
// 에서 잘렸다("둔촌주공, 전세 눈치게임 시…"). 렌더러의 확대 계산이 글자
// 폭까지 정확히 따라오지 않는다. 대신 에디터가 쓰는 배율 그대로 그리고,
// 해상도는 브라우저의 deviceScaleFactor 로 올린다 — 화면에서 보이는 그림이
// 그대로 커지므로 잘릴 일이 없다.
const CAPTURE_SCALE = 1;

// 카드 글꼴. layout 에서 불러오지 않으므로 여기서 직접 넣는다 —
// 안 넣으면 Jua/Do Hyeon 이 빠진 채로 캡처돼 화면과 다른 그림이 나온다.
const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Jua&family=Do+Hyeon' +
  '&family=Noto+Sans+KR:wght@300;400;500;600;700;900' +
  '&family=Nanum+Gothic:wght@400;700;800' +
  '&family=Black+Han+Sans&family=Gaegu:wght@300;400;700&display=swap';

type Page = {
  blocks?: unknown[];
  styleVariant?: string;
  noteLabel?: string;
  noteNumber?: string;
  // 사진 배경(MCP save_cardnews_exact 의 photoBgUrl 을 서버가 우리 저장소에 올려 고정한 주소)
  photoBg?: string;
  overlay?: string;
  brandTone?: 'gold' | 'sage';
  blocksOffsetY?: number;
  titleStyle?: React.ComponentProps<typeof BlockRenderer>['titleStyle'];
  subtitleStyle?: React.ComponentProps<typeof BlockRenderer>['subtitleStyle'];
  bulletStyle?: React.ComponentProps<typeof BlockRenderer>['bulletStyle'];
};

// 사진 배경 카드 — 편집기 CardView(editor/page.tsx)의 기본 분기를 그대로 옮겼다:
// 사진 + 가독성용 어두운 오버레이 + BlockRenderer.
// BlockRenderer 는 보호 파일이라 고치지 않고 불러다 쓴다. 편집기 쪽 표시는 따로 정한다.
// 클래스(Tailwind) 대신 같은 값을 inline 으로 적었다 — 이 화면은 다른 분기들도 inline 이다.
const PHOTO_OVERLAY = 'linear-gradient(to top, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.40) 100%)';

function PhotoCard({ page }: { page: Page }) {
  const offsetY = page.blocksOffsetY ?? 70;
  return (
    <>
      {/* crossOrigin 은 일부러 안 둔다 — 캡처에는 필요 없고, CORS 헤더가 없으면 오히려 그림이 안 뜬다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={page.photoBg}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: page.overlay || PHOTO_OVERLAY }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: `${100 - offsetY}%`,
            left: 28,
            right: 28,
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: 40,
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column', width: '100%', marginTop: 'auto' }}>
            <BlockRenderer
              blocks={(page.blocks || []) as never}
              brandTone={page.brandTone}
              availableHeight={Math.floor((525 * offsetY) / 100 - 40)}
              titleStyle={page.titleStyle}
              subtitleStyle={page.subtitleStyle}
              bulletStyle={page.bulletStyle}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default function CaptureSheet({ pages }: { pages: Page[] }) {
  // 글꼴이 다 온 뒤에야 카드를 그린다.
  //
  // 순서를 지키지 않으면 글자가 잘린다. 렌더러는 올라오자마자 글자 크기를
  // 재서 줄을 나누는데, 그때 Jua 가 아직 없으면 더 넓은 대체 글꼴로 재고
  // 나중에 다시 재지 않는다. 실제로 "둔촌주공, 전세 눈치게임 시…" 에서
  // 제목이 잘려 나갔다. 화면에서 쓸 때는 글꼴이 이미 캐시에 있어 이 문제가
  // 드러나지 않는다 — 크론에서 새로 여는 브라우저에서만 생긴다.
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.crossOrigin = 'anonymous';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);

    let cancelled = false;
    (async () => {
      // 글꼴이 실제로 올라올 때까지 기다린다. fonts.ready 만으로는
      // 아직 요청하지 않은 글꼴이 빠질 수 있어 이름을 집어 부른다.
      try {
        await Promise.all([
          document.fonts.load('700 40px Jua'),
          document.fonts.load('400 40px "Do Hyeon"'),
          document.fonts.load('700 40px "Noto Sans KR"'),
        ]);
        await document.fonts.ready;
      } catch {
        /* 글꼴을 못 받아도 캡처는 진행한다 — 빈 화면보다는 낫다 */
      }
      if (cancelled) return;
      setFontsReady(true);
      // 렌더러가 크기를 재고 자리를 잡을 시간을 준다.
      await new Promise(r => setTimeout(r, 900));
      // 사진 배경 같은 <img> 가 다 받아질 때까지 기다린다(최대 15초).
      // 이 줄이 없으면 사진이 오기 전에 캡처돼 오버레이와 글자만 찍힌다 —
      // 렌더 화면은 글꼴이 온 뒤에야 카드를 그리므로 사진은 networkidle 이후에 요청된다.
      await Promise.race([
        Promise.all(
          Array.from(document.images).map(img =>
            img.complete
              ? null
              : new Promise<void>(res => {
                  img.addEventListener('load', () => res(), { once: true });
                  img.addEventListener('error', () => res(), { once: true });
                }),
          ),
        ),
        new Promise(r => setTimeout(r, 15_000)),
      ]);
      if (!cancelled) document.body.setAttribute('data-capture-ready', '1');
    })();

    return () => { cancelled = true; };
  }, []);

  if (!fontsReady) return <div style={{ background: '#fff' }} />;

  // 개발 중 뜨는 Next.js 표시가 카드 위에 겹쳐 찍히지 않게 한다.
  // 운영 빌드에는 없지만, 있으면 그림에 그대로 남으므로 막아 둔다.
  const hideOverlays = 'nextjs-portal, #__next-build-watcher { display: none !important; }';

  return (
    <div style={{ background: '#fff' }}>
      <style>{hideOverlays}</style>
      {pages.map((p, i) => (
        <div
          key={i}
          data-capture-slide={i}
          style={{
            width: 420 * CAPTURE_SCALE,
            height: 525 * CAPTURE_SCALE,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {p.photoBg ? (
            <PhotoCard page={p} />
          ) : p.styleVariant === 'hybridPaper' ? (
            <NewspaperRenderer blocks={(p.blocks || []) as never} scale={CAPTURE_SCALE} index={i} noteLabel={p.noteLabel} noteNumber={p.noteNumber} />
          ) : p.styleVariant === 'impact' ? (
            <ImpactRenderer blocks={(p.blocks || []) as never} scale={CAPTURE_SCALE} index={i} noteLabel={p.noteLabel} noteNumber={p.noteNumber} />
          ) : (
            <HybridRenderer blocks={(p.blocks || []) as never} scale={CAPTURE_SCALE} index={i} noteLabel={p.noteLabel} noteNumber={p.noteNumber} />
          )}
        </div>
      ))}
    </div>
  );
}
