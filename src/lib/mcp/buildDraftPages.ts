import type { SlideBlock, BrandTone } from '@/lib/cardnews/blocks';
import { tone } from '@/lib/cardnews/theme';
import { normalizeHeadlines } from '@/lib/cardnews/normalizeHeadline';

// generate_cardnews MCP 도구용 — /api/generate/unified 가 돌려주는 cardNews[]를
// card_designs.pages_data 로 바꾼다.
//
// 원래 이 변환은 src/app/cardnews/page.tsx(handleGenerateUnified, 브라우저 전용)에만
// 있고, 배경이미지 검색(/api/images/search)·AI 노트 이미지 재생성까지 거친다.
// MCP는 그 비용·시간을 쓸 수 없어 최소 버전으로 새로 짠다 — 배경이미지 없이 저장한다.
//
// 렌더는 문제없다: 서버 캡처가 쓰는 CaptureSheet.tsx → HybridRenderer는 blocks·
// styleVariant·noteLabel/noteNumber만 읽고 bgImage/overlay/titleStyle 등은 쓰지 않는다
// (src/app/render/cardnews/[id]/CaptureSheet.tsx 확인). 실제 운영 중인 '자동 뉴스'
// 카테고리 행들도 bgImage:'' 로 저장되어 매일 캡처·발행되고 있다(2026-09-29 DB 확인).
// 에디터 쪽은 3단계에서 브라우저로 직접 확인한다.

type UnifiedCard = {
  page?: number;
  title?: string;
  subtitle?: string;
  body?: string;
  imageKeyword?: string;
  brandTone?: string;
  showFrame?: boolean;
  blocks?: SlideBlock[];
};

export type DraftPage = {
  id: string;
  bgImage: string;
  bgLabel: string;
  overlay: string;
  title: string;
  subtitle: string;
  accent: string;
  layout: 'bottom-left-list';
  blocks: SlideBlock[];
  brandTone: BrandTone;
  showFrame: boolean;
  blocksOffsetY: number;
  ratio: string;
  styleVariant: 'hybrid';
  imageKeyword: string;
};

export function buildDraftPages(cards: UnifiedCard[], ratio = '4:5'): DraftPage[] {
  return cards.map((card, i) => {
    const brandTone: BrandTone = card.brandTone === 'sage' ? 'sage' : 'gold';
    const rawBlocks = Array.isArray(card.blocks) && card.blocks.length > 0
      ? card.blocks
      : [{ type: 'headline', text: card.title || `${i + 1}장` } as SlideBlock];

    return {
      id: String(i + 1),
      bgImage: '',
      bgLabel: '노트(빠름)',
      overlay: '',
      title: card.title || '',
      subtitle: card.subtitle || '',
      accent: tone(brandTone).accent,
      layout: 'bottom-left-list',
      blocks: normalizeHeadlines(rawBlocks),
      brandTone,
      showFrame: card.showFrame !== undefined ? card.showFrame : true,
      blocksOffsetY: i === 0 ? 78 : 90,
      ratio,
      styleVariant: 'hybrid',
      imageKeyword: card.imageKeyword || '',
    };
  });
}
