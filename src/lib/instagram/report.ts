import type { SupabaseClient } from '@supabase/supabase-js';

// 인스타 관리 점검표. 토큰은 서버 안에서만 쓰고 응답에는 넣지 않는다.
// 사람이 읽는 주간 점검과 Claude 의 instagram-manager 스킬이 같이 쓴다.

const IG = 'https://graph.instagram.com/v21.0';

async function get(path: string, token: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${IG}/${path}${path.includes('?') ? '&' : '?'}access_token=${token}`);
    return (await res.json()) as Record<string, unknown>;
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : String(e) } };
  }
}
const errMsg = (j: Record<string, unknown>) => (j.error as { message?: string } | undefined)?.message;

export async function buildIgReport(sb: SupabaseClient, days = 7) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data: acc } = await sb.from('sns_accounts').select('access_token, extra').eq('platform', 'instagram').limit(1).maybeSingle();
  const out: Record<string, unknown> = { 기간일수: days };

  if (!acc?.access_token) return { ...out, 오류: '인스타 연동 정보가 없습니다' };
  const token = acc.access_token as string;
  out.토큰만료 = (acc.extra as { expires_at?: string } | null)?.expires_at ?? '기록 없음';

  const me = await get('me?fields=username,account_type,followers_count,follows_count,media_count,biography', token);
  out.계정 = errMsg(me) ? { 오류: errMsg(me) } : me;

  const media = await get('me/media?fields=timestamp,like_count,comments_count,media_type,caption&limit=30', token);
  const list = (Array.isArray(media.data) ? media.data : []) as { timestamp: string; like_count?: number; comments_count?: number; media_type: string; caption?: string }[];
  const recent = list.filter(m => m.timestamp >= since);
  out.최근게시물 = {
    개수: recent.length,
    좋아요합: recent.reduce((s, m) => s + (m.like_count ?? 0), 0),
    댓글합: recent.reduce((s, m) => s + (m.comments_count ?? 0), 0),
    유형: [...new Set(recent.map(m => m.media_type))],
    해시태그있는글: recent.filter(m => (m.caption ?? '').includes('#')).length,
    반응있는글: recent.filter(m => (m.like_count ?? 0) + (m.comments_count ?? 0) > 0)
      .map(m => ({ 날짜: m.timestamp.slice(5, 10), 좋아요: m.like_count ?? 0, 댓글: m.comments_count ?? 0, 제목: (m.caption ?? '').split('\n')[0].slice(0, 40) })),
  };

  // 도달·저장·공유는 manage_insights 권한이 있어야 읽힌다
  const first = list[0] as { id?: string } | undefined;
  const ins = first?.id ? await get(`${(media.data as { id: string }[])[0].id}/insights?metric=reach,saved,shares`, token) : null;
  out.인사이트 = ins && !errMsg(ins) ? '권한 있음' : `권한 없음 — SNS 설정에서 인스타 재연동 필요 (${errMsg(ins ?? {}) ?? '게시물 없음'})`;

  const { data: posts } = await sb.from('scheduled_posts').select('status, scheduled_at, design_name, error_message').gte('scheduled_at', since).order('scheduled_at', { ascending: false });
  out.발행기록 = {
    성공: (posts ?? []).filter(p => p.status === 'published').length,
    실패: (posts ?? []).filter(p => p.status === 'failed').map(p => ({ 일시: String(p.scheduled_at).slice(0, 16), 사유: String(p.error_message ?? '').slice(0, 80) })),
    대기: (posts ?? []).filter(p => p.status === 'pending').length,
    최근제목: (posts ?? []).slice(0, 7).map(p => p.design_name),
  };

  const { data: runs } = await sb.from('automation_runs').select('created_at, step, reason').eq('ok', false).gte('created_at', since).order('created_at', { ascending: false }).limit(20);
  out.자동작업실패 = (runs ?? []).filter(r => !/올릴 게시물이 없었습니다/.test(String(r.reason ?? '')))
    .map(r => ({ 일시: String(r.created_at).slice(5, 16), 단계: r.step, 사유: String(r.reason ?? '').slice(0, 80) }));
  return out;
}
