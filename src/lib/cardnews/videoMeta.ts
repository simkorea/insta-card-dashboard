import type { SlideBlock } from './blocks';
import { readCardBlocks } from './readCardBlocks';

// 영상으로 올릴 때 쓸 제목과 캡션을 카드뉴스에서 뽑는다.
//
// 유튜브는 제목이 필수인데, 영상 만들고 발행 화면에 오면 늘 비어 있어서
// 카드에 이미 쓴 문구를 다시 타이핑하고 있었다.
//
// 여기서도 말을 새로 짓지 않는다. 카드에 적힌 제목을 그대로 옮긴다 —
// 카드 문구는 생성 단계의 가드레일(원문 충실도, 수치 지어내기 금지)을
// 통과한 것이라, 다시 쓰게 하면 그 검증을 우회하는 셈이 된다.

type PageLike = { title?: string; blocks?: SlideBlock[] };

/** 보관함 이름에 붙는 말머리는 제목에 쓰지 않는다 */
function cleanName(name: string): string {
  return name.replace(/^\s*\[(자동|단지)\]\s*/, '').trim();
}

function headlineOf(p: PageLike | undefined): string {
  if (!p) return '';
  if (p.blocks?.length) {
    const f = readCardBlocks(p.blocks);
    if (f.headline) return f.headline.trim();
  }
  return (p.title || '').trim();
}

/** 유튜브 제목 (100자 제한) */
export function buildVideoTitle(pages: PageLike[], designName = ''): string {
  const cover = headlineOf(pages[0]);
  const raw = cover || cleanName(designName);
  return raw.length > 100 ? `${raw.slice(0, 99)}…` : raw;
}

/**
 * 캡션. 표지 문구 아래에 각 장의 제목을 목차처럼 세운다.
 * 카드에 적힌 문장만 쓰므로 없는 내용이 섞이지 않는다.
 */
export function buildVideoCaption(pages: PageLike[], designName = ''): string {
  const cover = headlineOf(pages[0]) || cleanName(designName);
  const items = pages.slice(1).map(headlineOf).filter(Boolean);
  // 마무리 장("저장해두고 …")은 목차에 넣지 않는다 — 내용이 아니다
  const body = items.filter(t => !/^저장해\s*두고|매일 아침 확인/.test(t));

  const lines: string[] = [];
  if (cover) lines.push(cover);
  if (body.length) {
    lines.push('');
    for (const t of body) lines.push(`· ${t}`);
  }
  return lines.join('\n').trim();
}
