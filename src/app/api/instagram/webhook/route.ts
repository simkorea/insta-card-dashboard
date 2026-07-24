import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateReplyDrafts } from '@/lib/comments/generateReplyDrafts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Meta의 웹훅 구독 확인 (앱 대시보드에서 콜백 URL 등록 시 1회 호출됨)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'verify_token 불일치' }, { status: 403 });
}

function isValidSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

interface InboxRow {
  source: 'comment' | 'dm';
  ig_object_id: string;
  thread_or_media_id: string | null;
  from_ig_id: string | null;
  from_username: string | null;
  text: string;
}

function extractInboxRows(payload: any): InboxRow[] {
  const rows: InboxRow[] = [];
  const entries = payload?.entry ?? [];

  for (const entry of entries) {
    // 댓글 이벤트
    for (const change of entry.changes ?? []) {
      if (change.field !== 'comments') continue;
      const v = change.value ?? {};
      if (!v.id || !v.text) continue;
      rows.push({
        source: 'comment',
        ig_object_id: v.id,
        thread_or_media_id: v.media?.id ?? null,
        from_ig_id: v.from?.id ?? null,
        from_username: v.from?.username ?? null,
        text: v.text,
      });
    }

    // DM 이벤트
    for (const msg of entry.messaging ?? []) {
      if (!msg.message?.text || !msg.message?.mid) continue;
      if (msg.message.is_echo) continue; // 우리가 보낸 메시지 에코는 무시
      rows.push({
        source: 'dm',
        ig_object_id: msg.message.mid,
        thread_or_media_id: msg.sender?.id ?? null,
        from_ig_id: msg.sender?.id ?? null,
        from_username: null,
        text: msg.message.text,
      });
    }
  }

  return rows;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!isValidSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: '서명 검증 실패' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: '잘못된 payload' }, { status: 400 });
  }

  const rows = extractInboxRows(payload);

  for (const row of rows) {
    const { data: inserted, error } = await supabase
      .from('instagram_inbox')
      .upsert(
        { ...row, status: 'pending' },
        { onConflict: 'ig_object_id', ignoreDuplicates: true }
      )
      .select('id')
      .maybeSingle();

    if (error || !inserted) continue; // 중복 웹훅이거나 저장 실패 — 초안 생성 생략

    try {
      const replies = await generateReplyDrafts({ comment: row.text, tone: 'friendly' });
      await supabase
        .from('instagram_inbox')
        .update({ ai_drafts: replies, status: 'drafted', updated_at: new Date().toISOString() })
        .eq('id', inserted.id);
    } catch {
      // 초안 생성 실패해도 원본은 이미 저장됨 — 받은함에서 수동으로 재생성 가능하도록 pending 유지
    }
  }

  // Meta는 200 응답을 빠르게 받아야 재시도를 하지 않음
  return NextResponse.json({ received: rows.length });
}
