import { z } from 'zod';
import type { SlideBlock } from '@/lib/cardnews/blocks';

// save_cardnews_exact 용 — 입력 모양(길이 제한)·블록 변환·도장 규칙. AI 는 어디에도 없다.
//
// 이 파일은 zod 말고는 아무것도 import 하지 않는다(타입 import 는 컴파일 때 지워진다).
// 그래서 scripts/test-exact-slides.mjs 가 Node 로 직접 읽어 테스트할 수 있다.
//
// 원칙: 받은 글자는 한 글자도 바꾸지 않는다(trim 도 하지 않는다). 칸이 없으면 블록도 없다.

export type DraftStyle = 'note' | 'impact' | 'paper';

export const exactSlideSchema = z.object({
  headline: z.string().min(1).max(18),
  body: z.string().min(1).max(120),
  points: z.array(z.string().min(1).max(20)).max(4).optional(),
  eyebrow: z
    .string()
    .min(1)
    .max(12)
    .optional()
    .describe("띠지(섹션 라벨). 예: '① 혜택'. 노트·신문 카드는 앞의 번호를 떼고 라벨로 보여준다."),
  stats: z
    .array(
      z.object({
        value: z.string().min(1).max(10).describe("숫자·값. 예: '84㎡', '5.2억'"),
        label: z.string().min(1).max(12).describe("값의 이름. 예: '전용면적'"),
      })
    )
    .max(3)
    .optional()
    .describe('숫자표 (최대 3개). 첫 항목이 크게 강조된다.'),
  badges: z.array(z.string().min(1).max(8)).max(3).optional().describe('배지 (최대 3개). points 와 같이 쓸 수 없다.'),
  source: z.string().min(1).max(40).optional().describe("출처 한 줄. 예: '출처: 국토교통부 실거래가'"),
});

export type ExactSlide = z.infer<typeof exactSlideSchema>;

/**
 * 슬라이드 하나를 카드 블록으로 바꾼다. 받은 글자를 그대로 담는다.
 *
 * 순서: eyebrow → headline → sub → statGrid → checklist → badgeRow → sourceNote.
 * 선택 칸을 안 주면 예전과 똑같이 headline · sub · (checklist) 만 나온다.
 */
export function buildExactBlocks(s: ExactSlide): SlideBlock[] {
  const blocks: SlideBlock[] = [];
  if (s.eyebrow) blocks.push({ type: 'eyebrow', text: s.eyebrow });
  blocks.push({ type: 'headline', text: s.headline });
  blocks.push({ type: 'sub', text: s.body });
  if (s.stats?.length) {
    blocks.push({
      type: 'statGrid',
      // 한 개짜리 표는 열 수를 정하지 않는다 (타입은 2~4 만 허용)
      ...(s.stats.length >= 2 ? { cols: s.stats.length as 2 | 3 } : {}),
      items: s.stats.map(({ value, label }) => ({ value, label })),
    });
  }
  if (s.points?.length) blocks.push({ type: 'checklist', items: s.points });
  if (s.badges?.length) blocks.push({ type: 'badgeRow', badges: s.badges.map((text) => ({ text })) });
  if (s.source) blocks.push({ type: 'sourceNote', text: s.source });
  return blocks;
}

/**
 * 스키마가 못 막는 조합을 거절한다. 통과하면 null, 거절하면 이유(한국어).
 *
 * points 와 badges 를 같이 주면 노트·신문 카드는 points 만 그린다
 * (readCardBlocks: points = checklist 가 있으면 checklist, 없으면 badges).
 * 받은 글자가 조용히 사라지는 것보다 거절하는 편이 낫다.
 */
export function checkExactSlides(slides: ExactSlide[]): string | null {
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (s.points?.length && s.badges?.length) {
      return (
        `slides[${i}]: points 와 badges 는 같은 장에 같이 쓸 수 없습니다. ` +
        '노트·신문 카드는 둘 중 하나(points)만 그려서 badges 글자가 사라집니다. 하나만 주세요.'
      );
    }
  }
  return null;
}

/** 'No.MMDD' (한국 시간). 원본: src/lib/newsCardnews/generateDraft.ts 405-406 */
export function kstNoteNumber(now: number = Date.now()): string {
  const kst = new Date(now + 9 * 60 * 60 * 1000);
  return `No.${String(kst.getUTCMonth() + 1).padStart(2, '0')}${String(kst.getUTCDate()).padStart(2, '0')}`;
}

/**
 * 장마다 붙는 노트 도장(noteLabel · noteNumber).
 *
 * - impact: noteNumber 는 쪽번호("2 / 5")로 쓴다 (예전과 같음). noteLabel 은 주면 라벨 자리에 쓴다.
 * - note · paper: noteLabel 이나 noteNumber 를 하나라도 주면 도장이 붙는다.
 *   noteNumber 를 안 주면 'No.MMDD' 를 자동으로 넣는다. 둘 다 안 주면 도장이 없다(예전과 같음).
 */
export function resolveStamp(
  style: DraftStyle,
  index: number,
  total: number,
  opts?: { noteLabel?: string; noteNumber?: string },
  now?: number
): { noteLabel?: string; noteNumber?: string } {
  if (style === 'impact') {
    return {
      ...(opts?.noteLabel ? { noteLabel: opts.noteLabel } : {}),
      noteNumber: `${index + 1} / ${total}`,
    };
  }
  if (!opts?.noteLabel && !opts?.noteNumber) return {};
  return {
    ...(opts.noteLabel ? { noteLabel: opts.noteLabel } : {}),
    noteNumber: opts.noteNumber ?? kstNoteNumber(now),
  };
}
