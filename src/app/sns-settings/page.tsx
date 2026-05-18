'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';

interface IgSettings {
  username?: string;
  ig_user_id?: string;
}

export default function SnsSettingsPage() {
  const router = useRouter();
  const [igSettings, setIgSettings] = useState<IgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch('/api/instagram/settings')
      .then(r => r.json())
      .then(data => setIgSettings(data?.settings?.ig_user_id ? data.settings : null))
      .finally(() => setLoading(false));
  }, []);

  const disconnect = async () => {
    if (!confirm('Instagram 연동을 해제하시겠습니까?')) return;
    setDisconnecting(true);
    await fetch('/api/instagram/settings', { method: 'DELETE' });
    setIgSettings(null);
    setDisconnecting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={16} /> 돌아가기
        </button>

        <h1 className="text-xl font-bold text-gray-900 mb-6">SNS 계정 연동·관리</h1>

        {/* Instagram */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">IG</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Instagram</p>
              {loading ? (
                <p className="text-xs text-gray-400">확인 중...</p>
              ) : igSettings?.username ? (
                <div className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-green-500" />
                  <p className="text-xs text-green-600 font-medium">@{igSettings.username} 연결됨</p>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <XCircle size={12} className="text-gray-400" />
                  <p className="text-xs text-gray-400">연동되지 않음</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <a
              href="/api/instagram/auth"
              className="flex-1 text-center py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              {igSettings?.username ? '재연동' : '연동하기'}
            </a>
            {igSettings?.username && (
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {disconnecting ? '해제 중...' : '연동 해제'}
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          재연동 완료 후 카드뉴스 에디터에서 Instagram 업로드를 사용하세요
        </p>
      </div>
    </div>
  );
}
