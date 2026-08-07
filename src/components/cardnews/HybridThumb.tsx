'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { HybridRenderer } from './HybridRenderer';
import { NewspaperRenderer } from './NewspaperRenderer';
import type { SlideBlock } from '@/lib/cardnews/blocks';

// 보관함·에디터가 각자 다른 페이지 타입을 쓰므로 필요한 필드만 받는다
type ThumbPage = { blocks?: SlideBlock[]; noteLabel?: string; noteNumber?: string; styleVariant?: string };

// 하이브리드 카드는 저장된 그림 파일이 없다 — 글자를 그때그때 조판하므로
// 썸네일 자리에서도 렌더러를 그대로 돌려야 미리보기가 나온다.
// (bgImage로 <img>를 그리면 src=""가 되어 깨진 이미지 아이콘이 뜬다.)
//
// 렌더러는 420px 폭 기준이라 실제 칸 너비를 재서 배율을 넘긴다.
export function HybridThumb({ page, index }: { page: ThumbPage | null | undefined; index: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className="relative w-full h-full overflow-hidden bg-[#F3F0E7]">
      {w > 0 && (page?.styleVariant === 'hybridPaper' ? (
        <NewspaperRenderer
          blocks={page?.blocks || []}
          scale={w / 420}
          index={index}
          noteLabel={page?.noteLabel}
          noteNumber={page?.noteNumber}
        />
      ) : (
        <HybridRenderer
          blocks={page?.blocks || []}
          scale={w / 420}
          index={index}
          noteLabel={page?.noteLabel}
          noteNumber={page?.noteNumber}
        />
      ))}
    </div>
  );
}
