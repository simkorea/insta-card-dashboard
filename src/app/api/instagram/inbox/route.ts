import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');

  let query = supabase.from('instagram_inbox').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  else query = query.in('status', ['pending', 'drafted']);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, status, chosen_reply } = body;
  if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (status) update.status = status;
  if (chosen_reply !== undefined) update.chosen_reply = chosen_reply;

  const { data, error } = await supabase
    .from('instagram_inbox')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
