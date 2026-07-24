import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { toKoreanError } from '@/lib/gemini';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { inboxId, message } = await request.json();
    if (!inboxId || !message?.trim()) {
      return NextResponse.json({ error: 'inboxId와 message가 필요합니다' }, { status: 400 });
    }

    const { data: item, error: itemError } = await supabase
      .from('instagram_inbox')
      .select('*')
      .eq('id', inboxId)
      .single();
    if (itemError || !item) return NextResponse.json({ error: '받은함 항목을 찾을 수 없습니다' }, { status: 404 });
    if (item.source !== 'comment') {
      return NextResponse.json({ error: 'DM은 /api/instagram/dm/send를 사용하세요' }, { status: 400 });
    }

    const { data: account } = await supabase
      .from('sns_accounts')
      .select('access_token')
      .eq('platform', 'instagram')
      .limit(1)
      .maybeSingle();
    if (!account?.access_token) {
      return NextResponse.json({ error: '연결된 인스타그램 계정이 없습니다. /sns-settings에서 연결해주세요.' }, { status: 400 });
    }

    const res = await fetch(
      `https://graph.instagram.com/v21.0/${item.ig_object_id}/replies`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ message: message.trim(), access_token: account.access_token }),
      }
    );
    const result = await res.json();

    if (!res.ok || result.error) {
      return NextResponse.json(
        { error: `인스타그램 전송 실패: ${result.error?.message || res.statusText}` },
        { status: 502 }
      );
    }

    await supabase
      .from('instagram_inbox')
      .update({ status: 'sent', chosen_reply: message.trim(), sent_reply_id: result.id, updated_at: new Date().toISOString() })
      .eq('id', inboxId);

    return NextResponse.json({ success: true, replyId: result.id });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
