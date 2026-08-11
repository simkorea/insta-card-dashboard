// 카드뉴스에 붙였던 캡션을 카드뉴스 id별로 기억한다.
//
// 영상은 카드뉴스로 만들면서 캡션은 매번 새로 쓰고 있었다. 같은 내용인데
// 두 번 쓰는 셈이라, 카드뉴스에서 만든 캡션을 영상 발행 때 그대로 쓰게 한다.
//
// 왜 브라우저에 두는가: card_designs 테이블에 캡션 칸이 없다. 칸을 늘리려면
// 사용자가 직접 SQL을 돌려야 해서, 우선 추가 작업 없이 되는 쪽으로 넣었다.
// 기기를 옮기면 따라오지 않는다 — 필요해지면 컬럼으로 옮긴다.

const KEY = 'cardnews_captions';

type Store = Record<string, string>;

function read(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCaption(designId: string | null | undefined, caption: string) {
  if (!designId || !caption.trim() || typeof window === 'undefined') return;
  try {
    const store = read();
    store[designId] = caption;
    // 무한정 쌓이지 않게 최근 50개만 남긴다
    const keys = Object.keys(store);
    if (keys.length > 50) {
      for (const k of keys.slice(0, keys.length - 50)) delete store[k];
    }
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* 용량 초과 등은 무시한다 — 캡션 기억은 부가 기능이다 */
  }
}

export function loadCaption(designId: string | null | undefined): string {
  if (!designId) return '';
  return read()[designId] || '';
}

/** 편집기가 지금 열고 있는 카드뉴스의 id (URL ?id= 우선, 없으면 보관함에서 연 id) */
export function currentDesignId(): string | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = new URLSearchParams(window.location.search).get('id');
  return fromUrl || localStorage.getItem('editingDesignId');
}
