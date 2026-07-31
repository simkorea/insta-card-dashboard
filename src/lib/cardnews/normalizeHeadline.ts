import type { SlideBlock } from './blocks';

// BlockRenderer는 headline을 `text` + 강조색 `accentText` 순으로 **이어붙여** 그린다
// (문장 안의 단어를 하이라이트하는 게 아니라 뒤에 덧붙는 별도 조각이다).
//
// 그런데 AI는 "제목 안의 강조할 단어"로 이해해서 text에 이미 들어 있는 말을
// accentText에도 그대로 넣는다. 그러면 카드에 이렇게 찍힌다:
//   text "둔촌주공 입주 앞두고 전세 눈치게임" + accent "눈치게임"
//   → "둔촌주공 입주 앞두고 전세 눈치게임 눈치게임"
//   text "SH 재개발 임대 3천421세대 청약 시작" + accent "3천421"
//   → "…청약 시작 3천421"
//
// 프롬프트로도 막지만, 프롬프트만 믿을 수 없어서 저장 직전에 한 번 더 거른다.

const squash = (s: string) => s.replace(/\s+/g, '');

/** headline 하나를 정리한다 */
export function normalizeHeadlineBlock<T extends SlideBlock>(block: T): T {
  if (block.type !== 'headline') return block;
  const text = (block.text || '').trim();
  const accent = (block.accentText || '').trim();
  if (!accent) return block;

  // 강조어가 제목 끝에 이미 붙어 있으면 본문에서 떼고 강조로만 남긴다
  if (text.endsWith(accent) && text.length > accent.length) {
    return { ...block, text: text.slice(0, text.length - accent.length).trim(), accentText: accent };
  }
  // 제목 중간에 이미 들어 있으면 뒤에 또 붙일 이유가 없다 → 강조어를 버린다
  if (squash(text).includes(squash(accent))) {
    return { ...block, text, accentText: undefined };
  }
  return { ...block, text, accentText: accent };
}

/** 슬라이드 블록 배열 전체를 정리한다 */
export function normalizeHeadlines(blocks: SlideBlock[]): SlideBlock[] {
  return blocks.map(normalizeHeadlineBlock);
}
