// Client-safe error message converter (no server-side imports)
export function friendlyError(msg: unknown): string {
  const s = String((msg as any)?.message ?? msg ?? '');
  if (
    s.includes('503') ||
    s.includes('Service Unavailable') ||
    s.includes('high demand') ||
    s.includes('temporarily')
  ) {
    return 'AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.';
  }
  if (s.includes('429') || s.includes('RESOURCE_EXHAUSTED') || s.includes('quota')) {
    return 'AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
  }
  if (s.includes('DEADLINE_EXCEEDED') || s.includes('timeout')) {
    return '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
  }
  if (s.includes('NetworkError') || s.includes('Failed to fetch') || s.includes('fetch failed')) {
    return '네트워크 연결을 확인해주세요.';
  }
  // Already in Korean or short enough — return as-is
  if (!s || /^[가-힣\s,.!?%()]+$/.test(s)) return s || '잠시 후 다시 시도해주세요.';
  // Raw English tech error — hide details from user
  return '잠시 후 다시 시도해주세요.';
}
