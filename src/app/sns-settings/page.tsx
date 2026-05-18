'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Save, Trash2 } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { Suspense } from 'react';

interface SnsAccount {
  platform: string;
  access_token?: string;
  refresh_token?: string;
  platform_user_id?: string;
  username?: string;
  extra?: Record<string, string>;
}

const PLATFORMS = [
  {
    id: 'instagram',
    label: 'Instagram',
    color: 'from-purple-500 via-pink-500 to-orange-400',
    abbr: 'IG',
    oauth: true,
    fields: [],
  },
  {
    id: 'threads',
    label: 'Threads',
    color: 'from-gray-800 to-gray-600',
    abbr: 'TH',
    oauth: false,
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'Threads 액세스 토큰', type: 'password' },
      { key: 'platform_user_id', label: 'User ID', placeholder: 'Threads 유저 ID (숫자)', type: 'text' },
    ],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    color: 'from-gray-900 to-gray-700',
    abbr: 'TT',
    oauth: false,
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'TikTok 액세스 토큰', type: 'password' },
      { key: 'refresh_token', label: 'Refresh Token', placeholder: 'TikTok 리프레시 토큰', type: 'password' },
      { key: 'extra.client_key', label: 'Client Key', placeholder: 'TikTok 앱 Client Key', type: 'text' },
      { key: 'extra.client_secret', label: 'Client Secret', placeholder: 'TikTok 앱 Client Secret', type: 'password' },
    ],
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    color: 'from-gray-900 to-black',
    abbr: 'X',
    oauth: false,
    comingSoon: true,
    fields: [],
  },
  {
    id: 'youtube',
    label: 'YouTube',
    color: 'from-red-600 to-red-500',
    abbr: 'YT',
    oauth: false,
    comingSoon: true,
    fields: [],
  },
] as const;

function SnsSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<Record<string, SnsAccount>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const igStatus = searchParams.get('instagram');
    if (igStatus === 'connected') {
      showToast(`Instagram @${searchParams.get('user') || ''} 연동 완료!`);
    } else if (igStatus === 'error') {
      showToast('Instagram 연동 실패. 다시 시도해 주세요.', false);
    }
  }, [searchParams]);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      const { data } = await supabase
        .from('sns_accounts')
        .select('platform, access_token, refresh_token, platform_user_id, username, extra')
        .eq('user_id', user.id);
      const map: Record<string, SnsAccount> = {};
      for (const row of data || []) map[row.platform] = row;
      setAccounts(map);
      setLoading(false);
    });
  }, [router]);

  const handleSave = async (platformId: string) => {
    setSaving(platformId);
    const values = formValues[platformId] || {};
    const supabase = createSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showToast('로그인이 필요합니다', false); setSaving(null); return; }

    const extra: Record<string, string> = {};
    const payload: Record<string, any> = {
      user_id: user.id,
      platform: platformId,
      updated_at: new Date().toISOString(),
    };

    for (const [k, v] of Object.entries(values)) {
      if (k.startsWith('extra.')) {
        extra[k.slice(6)] = v;
      } else {
        payload[k] = v;
      }
    }
    if (Object.keys(extra).length > 0) payload.extra = extra;

    const { error } = await supabase
      .from('sns_accounts')
      .upsert(payload, { onConflict: 'user_id,platform' });

    if (error) {
      showToast('저장 실패: ' + error.message, false);
    } else {
      setAccounts(prev => ({ ...prev, [platformId]: { ...prev[platformId], ...payload } }));
      showToast(`${PLATFORMS.find(p => p.id === platformId)?.label} 연동 저장 완료!`);
      setExpanded(null);
    }
    setSaving(null);
  };

  const handleDelete = async (platformId: string) => {
    if (!confirm('연동을 해제하시겠습니까?')) return;
    setDeleting(platformId);
    const supabase = createSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(null); return; }

    await supabase.from('sns_accounts').delete().eq('user_id', user.id).eq('platform', platformId);
    setAccounts(prev => { const n = { ...prev }; delete n[platformId]; return n; });
    showToast('연동이 해제되었습니다.');
    setDeleting(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={16} /> 돌아가기
        </button>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">SNS 계정 연동·관리</h1>
          <p className="text-xs text-gray-400 mt-1">각 계정은 내 계정에만 저장되며 다른 사용자와 공유되지 않습니다.</p>
        </div>

        <div className="space-y-3">
          {PLATFORMS.map((platform) => {
            const account = accounts[platform.id];
            const isConnected = !!account?.access_token || !!account?.platform_user_id;
            const isExpanded = expanded === platform.id;

            return (
              <div key={platform.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center shrink-0`}>
                      <span className="text-white text-xs font-bold">{platform.abbr}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{platform.label}</p>
                      {loading ? (
                        <p className="text-xs text-gray-400">확인 중...</p>
                      ) : isConnected ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-green-500" />
                          <p className="text-xs text-green-600 font-medium">
                            {account?.username ? `@${account.username} 연결됨` : '연결됨'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <XCircle size={12} className="text-gray-400" />
                          <p className="text-xs text-gray-400">
                            {(platform as any).comingSoon ? '준비 중' : '연동되지 않음'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    {!(platform as any).comingSoon && (
                      <div className="flex items-center gap-2 shrink-0">
                        {isConnected && (
                          <button
                            onClick={() => handleDelete(platform.id)}
                            disabled={deleting === platform.id}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="연동 해제"
                          >
                            {deleting === platform.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        )}
                        {platform.oauth ? (
                          <a
                            href="/api/instagram/auth"
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold hover:opacity-90 transition-opacity"
                          >
                            {isConnected ? '재연동' : '연동하기'}
                          </a>
                        ) : (
                          <button
                            onClick={() => setExpanded(isExpanded ? null : platform.id)}
                            className="flex items-center gap-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 transition-colors"
                          >
                            {isConnected ? '수정' : '연동하기'}
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 확장 폼 (수동 입력 플랫폼) */}
                {isExpanded && !platform.oauth && !(platform as any).comingSoon && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                    <div className="space-y-3">
                      {(platform as any).fields.map((field: any) => (
                        <div key={field.key}>
                          <label className="block text-xs font-bold text-gray-600 mb-1">{field.label}</label>
                          <input
                            type={field.type}
                            placeholder={field.placeholder}
                            defaultValue={
                              field.key.startsWith('extra.')
                                ? account?.extra?.[field.key.slice(6)] || ''
                                : (account as any)?.[field.key] || ''
                            }
                            onChange={e => setFormValues(prev => ({
                              ...prev,
                              [platform.id]: { ...(prev[platform.id] || {}), [field.key]: e.target.value },
                            }))}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 bg-white"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleSave(platform.id)}
                      disabled={saving === platform.id}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      {saving === platform.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {saving === platform.id ? '저장 중...' : '저장하기'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          연동된 계정 정보는 암호화되어 개인 계정에만 저장됩니다
        </p>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-lg transition-all z-50 ${toast.ok ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default function SnsSettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 size={24} className="animate-spin text-gray-400" /></div>}>
      <SnsSettingsContent />
    </Suspense>
  );
}
