'use client';
import { useState, useEffect } from 'react';
import { Users, UserPlus, Crown, Edit3, Shield, Eye, Trash2, Mail, Loader2, CheckCircle2, X, AlertCircle, Building2 } from 'lucide-react';

const ROLES = [
  { value: 'owner', label: '오너', desc: '모든 권한', icon: <Crown size={13} />, color: 'text-yellow-600 bg-yellow-50' },
  { value: 'editor', label: '에디터', desc: '콘텐츠 제작·편집', icon: <Edit3 size={13} />, color: 'text-blue-600 bg-blue-50' },
  { value: 'manager', label: '매니저', desc: '승인·발행 권한', icon: <Shield size={13} />, color: 'text-green-600 bg-green-50' },
  { value: 'viewer', label: '뷰어', desc: '조회만 가능', icon: <Eye size={13} />, color: 'text-gray-600 bg-gray-100' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['콘텐츠 제작', '콘텐츠 발행', '멤버 관리', '워크스페이스 설정', '결제 관리'],
  manager: ['콘텐츠 제작', '콘텐츠 발행', '콘텐츠 승인'],
  editor: ['콘텐츠 제작', '초안 저장'],
  viewer: ['콘텐츠 조회'],
};

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  created_at: string;
}

interface Invite {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  created_at: string;
}

interface Workspace {
  id: string;
  name: string;
  description: string;
}

export default function WorkspacePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'editor' });
  const [createForm, setCreateForm] = useState({ name: '', description: '', owner_email: '', owner_name: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [savedInvite, setSavedInvite] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'invites' | 'roles'>('members');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/workspace');
      const data = await res.json();
      setWorkspace(data.workspace);
      setMembers(data.members || []);
      setInvites(data.invites || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_workspace', ...createForm }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setShowCreateModal(false);
      await loadData();
    } catch (e: any) {
      alert('생성 실패: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.name.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite_member', workspace_id: workspace?.id, ...inviteForm }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSavedInvite(inviteForm.email);
      setInviteForm({ email: '', name: '', role: 'editor' });
      await loadData();
      setTimeout(() => { setSavedInvite(null); setShowInviteModal(false); }, 2000);
    } catch (e: any) {
      alert('초대 실패: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRole = async (member_id: string, role: string) => {
    await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_role', member_id, role }),
    });
    setMembers(prev => prev.map(m => m.id === member_id ? { ...m, role } : m));
  };

  const handleRemoveMember = async (member_id: string) => {
    if (!confirm('멤버를 제거하시겠습니까?')) return;
    await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_member', member_id }),
    });
    setMembers(prev => prev.filter(m => m.id !== member_id));
  };

  const handleCancelInvite = async (invite_id: string) => {
    await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel_invite', invite_id }),
    });
    setInvites(prev => prev.filter(i => i.id !== invite_id));
  };

  const getRoleInfo = (role: string) => ROLES.find(r => r.value === role) || ROLES[3];

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 size={24} className="animate-spin text-primary-400" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-5 shrink-0 flex items-center justify-between">
        <div className="ml-10 md:ml-0">
          <h1 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2">
            <Users size={20} className="text-primary-500" /> 팀 워크스페이스
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">팀원을 초대하고 역할을 관리하세요</p>
        </div>
        {workspace && (
          <button onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-sm">
            <UserPlus size={14} /> 멤버 초대
          </button>
        )}
      </div>

      {/* No workspace */}
      {!workspace && !isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
          <div className="w-20 h-20 bg-primary-50 rounded-3xl flex items-center justify-center mb-4">
            <Building2 size={36} className="text-primary-400" />
          </div>
          <h2 className="text-lg font-black text-gray-800 mb-2">워크스페이스가 없습니다</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm">팀 워크스페이스를 만들면 팀원을 초대하고 함께 콘텐츠를 관리할 수 있습니다</p>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-sm">
            <Building2 size={16} /> 워크스페이스 만들기
          </button>
        </div>
      )}

      {workspace && (
        <div className="flex-1 overflow-y-auto">
          {/* Workspace card */}
          <div className="px-8 py-5 bg-white border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-purple-500 rounded-2xl flex items-center justify-center text-white font-black text-lg">
                {workspace.name[0]}
              </div>
              <div>
                <h2 className="font-black text-gray-900 text-base">{workspace.name}</h2>
                <p className="text-sm text-gray-500">{workspace.description || '설명 없음'}</p>
              </div>
              <div className="ml-auto flex gap-4 text-center">
                <div><p className="text-xl font-black text-gray-900">{members.length}</p><p className="text-xs text-gray-400">멤버</p></div>
                <div><p className="text-xl font-black text-yellow-500">{invites.length}</p><p className="text-xs text-gray-400">초대 대기</p></div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white px-8">
            {[
              { id: 'members', label: `멤버 ${members.length}` },
              { id: 'invites', label: `초대 대기 ${invites.length}` },
              { id: 'roles', label: '역할 & 권한' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-8">
            {/* Members tab */}
            {activeTab === 'members' && (
              <div className="space-y-3 max-w-2xl">
                {members.map(m => {
                  const roleInfo = getRoleInfo(m.role);
                  return (
                    <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-purple-400 flex items-center justify-center text-white font-black text-sm shrink-0">
                        {(m.name || m.email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm">{m.name || '이름 없음'}</p>
                        <p className="text-xs text-gray-400 truncate">{m.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.role === 'owner' ? (
                          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${roleInfo.color}`}>
                            {roleInfo.icon} {roleInfo.label}
                          </span>
                        ) : (
                          <select value={m.role} onChange={e => handleUpdateRole(m.id, e.target.value)}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border-0 outline-none cursor-pointer ${roleInfo.color}`}>
                            {ROLES.filter(r => r.value !== 'owner').map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        )}
                        {m.role !== 'owner' && (
                          <button onClick={() => handleRemoveMember(m.id)} className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Invites tab */}
            {activeTab === 'invites' && (
              <div className="space-y-3 max-w-2xl">
                {invites.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Mail size={40} className="mx-auto mb-3 text-gray-200" />
                    <p className="font-medium">대기 중인 초대가 없습니다</p>
                  </div>
                )}
                {invites.map(inv => {
                  const roleInfo = getRoleInfo(inv.role);
                  return (
                    <div key={inv.id} className="bg-white rounded-2xl border border-yellow-100 shadow-sm px-5 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-500 shrink-0">
                        <Mail size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm">{inv.name}</p>
                        <p className="text-xs text-gray-400">{inv.email}</p>
                      </div>
                      <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${roleInfo.color}`}>
                        {roleInfo.icon} {roleInfo.label}
                      </span>
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full font-medium">초대 대기</span>
                      <button onClick={() => handleCancelInvite(inv.id)} className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg">
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Roles tab */}
            {activeTab === 'roles' && (
              <div className="grid grid-cols-2 gap-4 max-w-2xl">
                {ROLES.map(role => (
                  <div key={role.value} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full w-fit mb-3 ${role.color}`}>
                      {role.icon}
                      <span className="text-sm font-bold">{role.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{role.desc}</p>
                    <div className="space-y-1">
                      {ROLE_PERMISSIONS[role.value]?.map(perm => (
                        <div key={perm} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <CheckCircle2 size={11} className="text-green-500 shrink-0" /> {perm}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-black text-gray-900 text-lg mb-5">워크스페이스 만들기</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">워크스페이스 이름 *</label>
                <input value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="예: 마케팅팀, 콘텐츠크루" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">설명 (선택)</label>
                <input value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="팀 설명을 입력하세요" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">내 이름</label>
                <input value={createForm.owner_name} onChange={e => setCreateForm(p => ({ ...p, owner_name: e.target.value }))}
                  placeholder="이름 입력" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-500">취소</button>
                <button onClick={handleCreate} disabled={isSaving}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 disabled:bg-gray-200 flex items-center justify-center gap-2">
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  만들기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-gray-900 text-lg">멤버 초대</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {savedInvite ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <CheckCircle2 size={40} className="text-green-500" />
                <p className="font-bold text-gray-800">{savedInvite} 초대 완료!</p>
                <p className="text-sm text-gray-500">초대 대기 탭에서 확인할 수 있습니다</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">이메일 *</label>
                  <input value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                    type="email" placeholder="team@example.com" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">이름 *</label>
                  <input value={inviteForm.name} onChange={e => setInviteForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="홍길동" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">역할</label>
                  <div className="space-y-2">
                    {ROLES.filter(r => r.value !== 'owner').map(r => (
                      <button key={r.value} onClick={() => setInviteForm(p => ({ ...p, role: r.value }))}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${inviteForm.role === r.value ? 'border-primary-400 bg-primary-50' : 'border-gray-100 hover:border-gray-200'}`}>
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${r.color}`}>{r.icon} {r.label}</span>
                        <span className="text-xs text-gray-400">{r.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowInviteModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-500">취소</button>
                  <button onClick={handleInvite} disabled={isSaving}
                    className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 disabled:bg-gray-200 flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    초대 보내기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
