import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: 워크스페이스 + 멤버 목록
export async function GET() {
  const { data: ws } = await supabase.from('workspaces').select('*').limit(1).maybeSingle();
  const { data: members } = await supabase.from('workspace_members').select('*').order('created_at');
  const { data: invites } = await supabase.from('workspace_invites').select('*').eq('status', 'pending').order('created_at', { ascending: false });
  return NextResponse.json({ workspace: ws, members: members ?? [], invites: invites ?? [] });
}

// POST action: create_workspace | invite_member | update_member_role | remove_member | update_invite_status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create_workspace') {
      const { name, description } = body;
      const { data, error } = await supabase
        .from('workspaces')
        .insert({ name, description })
        .select()
        .single();
      if (error) throw error;
      // 생성자를 owner로 추가
      await supabase.from('workspace_members').insert({ workspace_id: data.id, email: body.owner_email || 'owner', role: 'owner', name: body.owner_name || '나', status: 'active' });
      return NextResponse.json({ workspace: data });
    }

    if (action === 'invite_member') {
      const { workspace_id, email, role, name } = body;
      // 중복 체크
      const { data: existing } = await supabase.from('workspace_members').select('id').eq('email', email).maybeSingle();
      if (existing) return NextResponse.json({ error: '이미 초대된 멤버입니다' }, { status: 400 });

      const token = Math.random().toString(36).substring(2, 15);
      const { data, error } = await supabase
        .from('workspace_invites')
        .insert({ workspace_id, email, role, name, token, status: 'pending' })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ invite: data });
    }

    if (action === 'accept_invite') {
      const { token } = body;
      const { data: invite } = await supabase.from('workspace_invites').select('*').eq('token', token).eq('status', 'pending').maybeSingle();
      if (!invite) return NextResponse.json({ error: '유효하지 않은 초대입니다' }, { status: 400 });
      await supabase.from('workspace_members').insert({ workspace_id: invite.workspace_id, email: invite.email, role: invite.role, name: invite.name, status: 'active' });
      await supabase.from('workspace_invites').update({ status: 'accepted' }).eq('id', invite.id);
      return NextResponse.json({ success: true });
    }

    if (action === 'update_role') {
      const { member_id, role } = body;
      const { data, error } = await supabase.from('workspace_members').update({ role }).eq('id', member_id).select().single();
      if (error) throw error;
      return NextResponse.json({ member: data });
    }

    if (action === 'remove_member') {
      const { member_id } = body;
      const { error } = await supabase.from('workspace_members').delete().eq('id', member_id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'cancel_invite') {
      const { invite_id } = body;
      await supabase.from('workspace_invites').update({ status: 'cancelled' }).eq('id', invite_id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
