// cardnews_to_blog 의 slideImageUrls 검사. 외부 import 없는 순수 함수.
//
// 호출하는 쪽(루나)이 render_design 으로 받아 둔 그림 주소를 넘기면, 도구가 새로 그리지
// 않고 그 주소를 쓴다. 대신 아무 주소나 받으면 바깥 스크립트가 ZIP을 만들 때 임의의
// 외부 주소를 내려받게 되므로, 우리 Supabase 저장소의 이 디자인 그림만 받는다.
//
// 통과 조건 (전부 만족해야 함):
//   1. 개수가 슬라이드 수와 같다 — 일부만 새로 그리는 방식은 없다
//   2. https 이고, 주소의 출처(origin)가 우리 Supabase 프로젝트와 같다
//   3. 경로가 /storage/v1/object/public/card-images/ 로 시작한다 (card-images 버킷)
//   4. 경로에 이 designId 가 들어 있다
//   5. 로그인 정보(user:pass@)·쿼리·해시·상위 경로(..)가 없다 — getPublicUrl 이 만드는
//      주소는 그런 것이 없으므로, 있으면 손으로 만든 주소다

const BUCKET_PATH = '/storage/v1/object/public/card-images/';

/** 통과하면 null, 거절하면 이유(한국어)를 돌려준다. */
export function checkSlideImageUrls(opts: {
  urls: string[];
  designId: string;
  slideCount: number;
  supabaseUrl?: string;
}): string | null {
  const { urls, designId, slideCount, supabaseUrl } = opts;

  if (!supabaseUrl) {
    return '저장소 주소 설정(NEXT_PUBLIC_SUPABASE_URL)이 없어 slideImageUrls를 검증할 수 없습니다.';
  }
  let allowedOrigin: string;
  try {
    allowedOrigin = new URL(supabaseUrl).origin;
  } catch {
    return '저장소 주소 설정이 올바르지 않아 slideImageUrls를 검증할 수 없습니다.';
  }

  if (urls.length !== slideCount) {
    return (
      `slideImageUrls 개수(${urls.length})가 슬라이드 수(${slideCount})와 다릅니다. ` +
      '일부만 새로 그리는 방식은 지원하지 않습니다 — 슬라이드 수만큼 모두 넘기거나, 아예 생략하세요.'
    );
  }

  const id = designId.toLowerCase();
  for (let i = 0; i < urls.length; i++) {
    const label = `slideImageUrls[${i}]`;
    let u: URL;
    try {
      u = new URL(urls[i]);
    } catch {
      return `${label}: 주소 형식이 올바르지 않습니다.`;
    }
    if (u.protocol !== 'https:') return `${label}: https 주소만 받습니다.`;
    if (u.origin !== allowedOrigin) return `${label}: 우리 Supabase 저장소 주소가 아닙니다. 외부 주소는 받지 않습니다.`;
    if (u.username || u.password) return `${label}: 로그인 정보가 들어간 주소는 받지 않습니다.`;
    if (u.search || u.hash) return `${label}: 쿼리·해시가 붙은 주소는 받지 않습니다.`;
    // %2e%2e 처럼 인코딩해 숨긴 .. 는 URL 파서가 먼저 정리해 버려 아래 검사에 안 걸린다.
    // 받는 쪽(바깥 스크립트)은 정리 없이 그대로 쓸 수 있으므로 원문에서 막는다.
    if (/%2e|%2f|%5c|\\/i.test(urls[i])) return `${label}: 인코딩된 경로 문자(. / \\)가 든 주소는 받지 않습니다.`;

    let path: string;
    try {
      path = decodeURIComponent(u.pathname);
    } catch {
      return `${label}: 경로를 해석하지 못했습니다.`;
    }
    if (path.split('/').includes('..')) return `${label}: 상위 경로(..)가 든 주소는 받지 않습니다.`;
    if (!path.startsWith(BUCKET_PATH)) return `${label}: card-images 버킷의 주소가 아닙니다.`;
    if (!path.toLowerCase().includes(id)) return `${label}: 이 카드뉴스(designId)의 그림 주소가 아닙니다.`;
  }
  return null;
}
