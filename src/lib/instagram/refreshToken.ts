import type { SupabaseClient } from '@supabase/supabase-js';

// 인스타 장기 토큰(IGAA…)은 60일 뒤 죽는다. 사람이 다시 연동하지 않으면
// 2026-09 에 78건이 "Session has expired" 로 실패했다. 크론이 매일 돌 때
// 20일 넘은 토큰을 새로 받아 둔다(갱신은 발급 24시간 뒤부터 가능, 만료 전이어야 한다).
// 이미 죽은 토큰은 갱신이 안 된다 — 그때는 사유를 돌려주고 사람이 '재연동'을 눌러야 한다.

const REFRESH_AFTER_DAYS = 20;
const DAY = 86_400_000;

export type RefreshResult =
  | { status: 'skipped'; reason: string }
  | { status: 'refreshed'; expiresAt: string }
  | { status: 'failed'; reason: string };

export async function refreshInstagramToken(supabase: SupabaseClient): Promise<RefreshResult> {
  const { data: acc, error } = await supabase
    .from('sns_accounts')
    .select('id, access_token, updated_at, extra')
    .eq('platform', 'instagram')
    .limit(1)
    .maybeSingle();
  if (error || !acc?.access_token) return { status: 'failed', reason: error?.message ?? '인스타 연동 정보가 없습니다' };

  const extra = (acc.extra ?? {}) as { refreshed_at?: string; expires_at?: string };
  const last = Date.parse(extra.refreshed_at ?? acc.updated_at);
  if (Date.now() - last < REFRESH_AFTER_DAYS * DAY) {
    return { status: 'skipped', reason: `${Math.floor((Date.now() - last) / DAY)}일 전 갱신, 아직 이릅니다` };
  }

  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${acc.access_token}`,
  );
  const j = await res.json().catch(() => ({}));
  if (!j.access_token) {
    return { status: 'failed', reason: `${j?.error?.message ?? `HTTP ${res.status}`} — 대시보드 SNS 설정에서 인스타를 다시 연동해 주세요` };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (Number(j.expires_in) || 60 * 86400) * 1000).toISOString();
  const { error: upErr } = await supabase
    .from('sns_accounts')
    .update({ access_token: j.access_token, updated_at: now.toISOString(), extra: { ...extra, refreshed_at: now.toISOString(), expires_at: expiresAt } })
    .eq('id', acc.id);
  if (upErr) return { status: 'failed', reason: `새 토큰 저장 실패: ${upErr.message}` };
  return { status: 'refreshed', expiresAt };
}
