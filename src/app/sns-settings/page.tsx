'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, Save, Trash2,
  ChevronDown, ChevronUp, ExternalLink, Info, Eye, EyeOff,
} from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface SnsAccount {
  platform: string;
  access_token?: string;
  refresh_token?: string;
  platform_user_id?: string;
  username?: string;
  extra?: Record<string, string>;
}

// ── 플랫폼 정의 ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: 'instagram',
    label: 'Instagram',
    color: 'from-purple-500 via-pink-500 to-orange-400',
    abbr: 'IG',
    oauth: true,
    authPath: '/api/instagram/auth',
    guide: {
      title: 'Instagram 연동 방법',
      steps: [
        { step: '1', text: '아래 "연동하기" 버튼을 클릭하세요.' },
        { step: '2', text: 'Meta(Facebook) 계정으로 로그인합니다.' },
        { step: '3', text: '앱 권한 허용 후 자동으로 연동이 완료됩니다.' },
      ],
      note: '⚠️ Instagram 비즈니스/크리에이터 계정이 필요합니다. 개인 계정은 API 업로드를 지원하지 않습니다.',
      links: [],
    },
    fields: [],
  },
  {
    id: 'threads',
    label: 'Threads',
    color: 'from-gray-800 to-gray-600',
    abbr: 'TH',
    oauth: false,
    guide: {
      title: 'Threads Access Token 발급 방법',
      steps: [
        { step: '1', text: 'Meta 개발자 포털(developers.facebook.com)에 접속합니다.' },
        { step: '2', text: '내 앱 → 앱 선택 → Threads API 제품 추가' },
        { step: '3', text: 'Threads API → 설정 → "사용자 토큰 생성" 클릭' },
        { step: '4', text: '생성된 Access Token을 복사합니다.' },
        { step: '5', text: 'User ID는 같은 화면 또는 Graph API Explorer에서 확인합니다.' },
      ],
      note: '💡 Threads와 Instagram은 같은 Meta 앱을 사용합니다. Instagram이 이미 연동되어 있다면 같은 앱에서 Threads 토큰도 발급받을 수 있습니다.',
      links: [
        { label: 'Meta 개발자 포털', url: 'https://developers.facebook.com' },
        { label: 'Threads API 문서', url: 'https://developers.facebook.com/docs/threads' },
      ],
    },
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'EAAxxxxxxxxxxxxxxx...', sensitive: true },
      { key: 'platform_user_id', label: 'Threads User ID', placeholder: '숫자 형식의 유저 ID (예: 12345678901234)', sensitive: false },
    ],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    color: 'from-gray-900 to-gray-700',
    abbr: 'TT',
    oauth: false,
    guide: {
      title: 'TikTok API 키 발급 방법',
      steps: [
        { step: '1', text: 'TikTok 개발자 포털(developers.tiktok.com)에 접속합니다.' },
        { step: '2', text: '로그인 후 "Manage apps" → "Connect an app" 클릭' },
        { step: '3', text: '앱 생성 후 "Client Key"와 "Client Secret"을 복사합니다.' },
        { step: '4', text: '앱 설정에서 "Content Posting API" 권한을 추가합니다.' },
        { step: '5', text: 'OAuth 인증을 통해 Access Token과 Refresh Token을 발급받습니다.' },
        { step: '6', text: 'Sandbox 계정이라면 developers.tiktok.com → Sandbox → Token 탭에서 바로 발급 가능합니다.' },
      ],
      note: '⚠️ TikTok API는 반드시 URL 소유권 인증이 필요합니다. 앱 설정 → Content Posting API → 도메인 등록란에 "insta-card-dashboard.vercel.app"을 등록하세요.',
      links: [
        { label: 'TikTok 개발자 포털', url: 'https://developers.tiktok.com' },
        { label: 'TikTok Content Posting API 문서', url: 'https://developers.tiktok.com/doc/content-posting-api-get-started' },
      ],
    },
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'act.xxxxxxxxxxxxxxx...', sensitive: true },
      { key: 'refresh_token', label: 'Refresh Token', placeholder: 'rft.xxxxxxxxxxxxxxx...', sensitive: true },
      { key: 'extra.client_key', label: 'Client Key', placeholder: 'sbxxxxxxxxxxxxxxx', sensitive: false },
      { key: 'extra.client_secret', label: 'Client Secret', placeholder: 'TikTok 앱 Client Secret', sensitive: true },
    ],
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    color: 'from-gray-900 to-black',
    abbr: 'X',
    oauth: false,
    comingSoon: true,
    guide: null,
    fields: [],
  },
  {
    id: 'youtube',
    label: 'YouTube',
    color: 'from-red-600 to-red-500',
    abbr: 'YT',
    oauth: true,
    authPath: '/api/youtube/auth',
    guide: {
      title: 'YouTube 연동 방법',
      steps: [
        { step: '1', text: 'Google Cloud Console에서 이 앱의 OAuth 클라이언트에 승인된 리디렉션 URI로 https://insta-card-dashboard.vercel.app/api/youtube/callback 을 등록합니다.' },
        { step: '2', text: '같은 프로젝트에서 "YouTube Data API v3"가 사용 설정돼 있는지 확인합니다.' },
        { step: '3', text: 'OAuth 동의 화면 → 데이터 액세스에 youtube.upload, youtube.readonly 범위를 추가합니다.' },
        { step: '4', text: '아래 "연동하기"를 눌러 구글 계정으로 로그인하고 권한을 허용합니다.' },
      ],
      note: '⚠️ 앱이 아직 테스트 모드라면 OAuth 동의 화면의 "테스트 사용자"에 본인 구글 계정을 추가해야 합니다. 업로드는 유튜브 API 기본 한도로 하루 약 6개까지 가능합니다.',
      links: [
        { label: 'Google Cloud Console — 사용자 인증 정보', url: 'https://console.cloud.google.com/apis/credentials' },
        { label: 'YouTube Data API v3 문서', url: 'https://developers.google.com/youtube/v3/docs/videos/insert' },
      ],
    },
    fields: [],
  },
];

// ── 컴포넌트 ────────────────────────────────────────────────────────────────────

function GuideSection({ guide }: { guide: NonNullable<typeof PLATFORMS[0]['guide']> }) {
  return (
    <div className="border-t border-gray-100 p-5 bg-blue-50/40">
      <div className="flex items-center gap-2 mb-3">
        <Info size={14} className="text-blue-500 shrink-0" />
        <p className="text-xs font-bold text-blue-700">{guide.title}</p>
      </div>
      <ol className="space-y-2 mb-3">
        {guide.steps.map(s => (
          <li key={s.step} className="flex gap-2.5">
            <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">{s.step}</span>
            <span className="text-xs text-gray-600 leading-relaxed">{s.text}</span>
          </li>
        ))}
      </ol>
      {guide.note && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          {guide.note}
        </p>
      )}
      {guide.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {guide.links.map(link => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-blue-600 font-medium hover:underline"
            >
              <ExternalLink size={11} />
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldInput({
  field,
  defaultValue,
  onChange,
}: {
  field: { key: string; label: string; placeholder: string; sensitive: boolean };
  defaultValue: string;
  onChange: (val: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1">{field.label}</label>
      <div className="relative">
        <input
          type={field.sensitive && !show ? 'password' : 'text'}
          placeholder={field.placeholder}
          defaultValue={defaultValue}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-xs outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 bg-white font-mono"
        />
        {field.sensitive && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

function SnsSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<Record<string, SnsAccount>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const igStatus = searchParams.get('instagram');
    if (igStatus === 'connected') showToast(`Instagram @${searchParams.get('user') || ''} 연동 완료!`);
    else if (igStatus === 'error') showToast('Instagram 연동 실패. 다시 시도해 주세요.', false);

    const ytStatus = searchParams.get('youtube');
    if (ytStatus === 'connected') showToast(`YouTube "${searchParams.get('user') || ''}" 채널 연동 완료!`);
    // 유튜브는 실패 원인이 여러 가지(리디렉션 미등록·범위 누락·채널 없음)라
    // "다시 시도"만 알리면 고칠 수가 없다. 서버가 보낸 이유를 그대로 보여준다.
    else if (ytStatus === 'error') showToast(`YouTube 연동 실패: ${searchParams.get('msg') || '알 수 없는 오류'}`, false);
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

  const setField = (platformId: string, key: string, val: string) => {
    setFormValues(prev => ({
      ...prev,
      [platformId]: { ...(prev[platformId] || {}), [key]: val },
    }));
  };

  const getFieldDefault = (platformId: string, key: string) => {
    const account = accounts[platformId];
    if (!account) return '';
    if (key.startsWith('extra.')) return account.extra?.[key.slice(6)] || '';
    return (account as any)[key] || '';
  };

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
      if (!v.trim()) continue;
      if (k.startsWith('extra.')) extra[k.slice(6)] = v;
      else payload[k] = v;
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
      setShowGuide(null);
    }
    setSaving(null);
  };

  const handleDelete = async (platformId: string) => {
    if (!confirm('연동을 해제하시겠습니까?')) return;
    setDeleting(platformId);
    const supabase = createSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeleting(null); return; }
    await supabase.from('sns_accounts').delete().eq('user_id', user.id).eq('platform', platformId);
    setAccounts(prev => { const n = { ...prev }; delete n[platformId]; return n; });
    setExpanded(null);
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
    <div className="min-h-screen bg-gray-50 p-5">
      <div className="max-w-lg mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={16} /> 돌아가기
        </button>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">SNS 계정 연동·관리</h1>
          <p className="text-xs text-gray-400 mt-1">내 SNS 계정을 연동하면 카드뉴스를 자동으로 업로드할 수 있습니다.</p>
        </div>

        <div className="space-y-3">
          {PLATFORMS.map((platform) => {
            const account = accounts[platform.id];
            const isConnected = !!(account?.access_token || account?.platform_user_id);
            const isExpanded = expanded === platform.id;
            const isGuideOpen = showGuide === platform.id;

            return (
              <div key={platform.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* 헤더 */}
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center shrink-0`}>
                      <span className="text-white text-xs font-bold">{platform.abbr}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{platform.label}</p>
                        {(platform as any).comingSoon && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">준비 중</span>
                        )}
                      </div>
                      {isConnected ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <CheckCircle2 size={11} className="text-green-500" />
                          <p className="text-xs text-green-600 font-medium">
                            {account?.username ? `@${account.username} 연결됨` : '연결됨'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-0.5">
                          <XCircle size={11} className="text-gray-400" />
                          <p className="text-xs text-gray-400">
                            {(platform as any).comingSoon ? '곧 지원 예정' : '연동되지 않음'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼들 */}
                    {!(platform as any).comingSoon && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isConnected && (
                          <button
                            onClick={() => handleDelete(platform.id)}
                            disabled={deleting === platform.id}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="연동 해제"
                          >
                            {deleting === platform.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />}
                          </button>
                        )}
                        {platform.oauth ? (
                          <a
                            href={(platform as any).authPath}
                            className={`px-3.5 py-2 rounded-xl bg-gradient-to-r ${platform.color} text-white text-xs font-bold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300 active:scale-[0.98] transition-opacity`}
                          >
                            {isConnected ? '재연동' : '연동하기'}
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              if (isExpanded) { setExpanded(null); setShowGuide(null); }
                              else { setExpanded(platform.id); setShowGuide(null); }
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                              isExpanded
                                ? 'bg-gray-100 text-gray-600'
                                : isConnected
                                ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                                : 'bg-primary-600 text-white hover:bg-primary-700'
                            }`}
                          >
                            {isExpanded ? '닫기' : isConnected ? '수정' : '연동하기'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* OAuth 플랫폼은 '연동하기'가 바로 외부로 나가는 링크라 확장 영역이 없다.
                    유튜브처럼 사전 설정(리디렉션 URI 등록 등)이 필요한 경우 볼 곳이 없어서
                    가이드 토글을 따로 둔다. */}
                {platform.oauth && platform.guide && (
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => setShowGuide(isGuideOpen ? null : platform.id)}
                      className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold text-blue-600 hover:bg-blue-50/50 focus:outline-none focus:bg-blue-50 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Info size={13} />
                        연동 전 준비할 것 보기
                      </span>
                      {isGuideOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {isGuideOpen && <GuideSection guide={platform.guide} />}
                  </div>
                )}

                {/* 확장 영역 (수동 토큰 입력) */}
                {isExpanded && !platform.oauth && !(platform as any).comingSoon && (
                  <>
                    {/* 가이드 토글 */}
                    {platform.guide && (
                      <div className="border-t border-gray-100">
                        <button
                          onClick={() => setShowGuide(isGuideOpen ? null : platform.id)}
                          className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold text-blue-600 hover:bg-blue-50/50 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <Info size={13} />
                            API 키 발급 방법 보기
                          </span>
                          {isGuideOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        {isGuideOpen && <GuideSection guide={platform.guide} />}
                      </div>
                    )}

                    {/* 입력 폼 */}
                    <div className="border-t border-gray-100 p-5 bg-gray-50/30">
                      <p className="text-xs font-bold text-gray-700 mb-3">API 키 입력</p>
                      <div className="space-y-3">
                        {(platform as any).fields.map((field: any) => (
                          <FieldInput
                            key={field.key}
                            field={field}
                            defaultValue={getFieldDefault(platform.id, field.key)}
                            onChange={val => setField(platform.id, field.key, val)}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => handleSave(platform.id)}
                        disabled={saving === platform.id}
                        className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {saving === platform.id
                          ? <><Loader2 size={14} className="animate-spin" /> 저장 중...</>
                          : <><Save size={14} /> 저장하기</>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 안내 문구 */}
        <div className="mt-6 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-700 mb-2">🔒 보안 안내</p>
          <ul className="space-y-1.5 text-[11px] text-gray-500 leading-relaxed">
            <li>• 입력한 API 키는 암호화되어 본인 계정에만 저장됩니다</li>
            <li>• 다른 사용자는 내 API 키에 절대 접근할 수 없습니다</li>
            <li>• 업로드 시 반드시 로그인 상태여야 하며 본인 계정으로만 업로드됩니다</li>
            <li>• API 키는 언제든지 "연동 해제"로 삭제할 수 있습니다</li>
          </ul>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-5 pb-6">
          문제가 있으면 각 플랫폼 공식 개발자 문서를 참고해 주세요
        </p>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-xl z-50 whitespace-nowrap ${toast.ok ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default function SnsSettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    }>
      <SnsSettingsContent />
    </Suspense>
  );
}
