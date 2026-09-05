import { createClient } from '@supabase/supabase-js';

// 자동 작업이 어떻게 끝났는지 한 줄 남긴다.
//
// 9/5 에 카드뉴스 초안이 안 만들어졌는데 이유를 끝내 확인하지 못했다.
// Hobby 는 런타임 로그를 1시간만 보관하고, 그때는 이미 하루가 지나 있었다.
// 결과물이 없다는 것만 알고 왜 없는지는 알 수 없었다.
//
// 기록이 실패해도 본 작업은 계속 간다 — 기록하려다 발행을 멈추면 본말전도다.

export type RunStep = 'briefing' | 'cardnews' | 'blog' | 'publish';

/** 한국 날짜 (YYYY-MM-DD) */
function kstDate(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function recordRun(
  step: RunStep,
  ok: boolean,
  reason?: string,
  ms?: number,
): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await supabase.from('automation_runs').insert({
      run_date: kstDate(),
      step,
      ok,
      // 사유는 화면에 그대로 보여줄 것이라 너무 길면 자른다
      reason: reason ? String(reason).slice(0, 300) : null,
      ms: typeof ms === 'number' ? Math.round(ms) : null,
    });
  } catch (e) {
    console.warn('[recordRun] 기록 실패(무시):', e instanceof Error ? e.message : String(e));
  }
}
