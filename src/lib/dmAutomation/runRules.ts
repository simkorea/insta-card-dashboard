import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AutomationResult {
  matched: boolean;
  ruleId?: string;
}

// 댓글에 활성화된 키워드 자동화 규칙이 매칭되면 DM을 자동 발송하고, 있다면 댓글에도
// 공개 답글을 남긴다. 규칙은 생성 시 기본 비활성 상태이며, 사람이 미리 문구를 검수하고
// 켠 규칙에 한해서만 동작한다 — 메시지 단위 승인이 아니라 규칙 단위 승인으로
// 자동화를 허용하는 설계 (매번 사람이 눌러야 하는 기존 받은함 흐름과는 별개).
export async function runDmAutomationForComment(
  inboxId: string,
  commentText: string,
  fromIgId: string | null,
  igObjectId: string
): Promise<AutomationResult> {
  if (!fromIgId) return { matched: false };

  const { data: rules } = await supabase
    .from('dm_automation_rules')
    .select('*')
    .eq('is_active', true);
  if (!rules || rules.length === 0) return { matched: false };

  const lowerText = commentText.toLowerCase();
  const rule = rules.find(r => lowerText.includes(String(r.keyword).toLowerCase()));
  if (!rule) return { matched: false };

  const { data: account } = await supabase
    .from('sns_accounts')
    .select('access_token, platform_user_id')
    .eq('platform', 'instagram')
    .limit(1)
    .maybeSingle();
  if (!account?.access_token || !account.platform_user_id) return { matched: false };

  const dmRes = await fetch(`https://graph.instagram.com/v21.0/${account.platform_user_id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: fromIgId },
      message: { text: rule.dm_message },
      access_token: account.access_token,
    }),
  });
  const dmResult = await dmRes.json();
  if (!dmRes.ok || dmResult.error) {
    // DM 실패(24시간 메시징 윈도우 초과 등) — 받은함은 그대로 두어 사람이 수동 처리하게 함
    return { matched: false };
  }

  if (rule.comment_reply?.trim()) {
    await fetch(`https://graph.instagram.com/v21.0/${igObjectId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ message: rule.comment_reply.trim(), access_token: account.access_token }),
    }).catch(() => {});
  }

  await supabase
    .from('instagram_inbox')
    .update({
      status: 'sent',
      chosen_reply: `[자동 DM 발송 · 규칙 "${rule.keyword}"] ${rule.dm_message}`,
      sent_reply_id: dmResult.message_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', inboxId);

  await supabase
    .from('dm_automation_rules')
    .update({ match_count: (rule.match_count ?? 0) + 1 })
    .eq('id', rule.id);

  return { matched: true, ruleId: rule.id };
}
