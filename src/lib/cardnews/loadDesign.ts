// 목록 API 는 표지 한 장(pages_data[0])과 장수(pages_count)만 준다.
// 편집·발행·다운로드·미리보기처럼 모든 장이 필요한 곳은 이 함수로 한 건을 읽어 온다.
export async function loadFullDesign<T extends { id: string | number; pages_data?: unknown[]; pages_count?: number }>(d: T): Promise<T> {
  if (!d.pages_count || (d.pages_data?.length ?? 0) >= d.pages_count) return d;
  const res = await fetch(`/api/designs/${d.id}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.design?.pages_data) throw new Error(json.error || '카드뉴스를 불러오지 못했습니다.');
  return { ...d, ...json.design };
}
