'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const pwMatch = password && confirmPw && password === confirmPw;
  const pwLength = password.length >= 6;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwLength) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (!pwMatch) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true);
    setError('');

    const supabase = createSupabaseBrowser();
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(
        authError.message.includes('already registered')
          ? '이미 가입된 이메일입니다. 로그인을 시도해 보세요.'
          : '회원가입 중 오류가 발생했습니다. 다시 시도해 주세요.'
      );
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-black text-2xl leading-none">s</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-gray-900">simple</span>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">이메일을 확인해 주세요!</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-1">
              <span className="font-semibold text-gray-700">{email}</span>으로
            </p>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              인증 링크를 발송했습니다. 메일함을 확인하고 링크를 클릭하면 바로 시작할 수 있습니다.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-all"
            >
              로그인 페이지로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white font-black text-2xl leading-none">s</span>
          </div>
          <span className="text-2xl font-black tracking-tight text-gray-900">simple</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">무료로 시작하세요 🚀</h1>
            <p className="text-sm text-gray-400 mt-1">AI 카드뉴스 & SNS 자동화 플랫폼</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="name@example.com"
                required
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100 placeholder:text-gray-300"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="6자 이상 입력"
                  required
                  className="w-full px-4 py-3 pr-11 border border-gray-200 rounded-xl text-sm outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100 placeholder:text-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password && (
                <p className={`text-[11px] mt-1 font-medium ${pwLength ? 'text-green-600' : 'text-red-400'}`}>
                  {pwLength ? '✓ 6자 이상' : '6자 이상 입력해 주세요'}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">비밀번호 확인</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setError(''); }}
                placeholder="비밀번호를 다시 입력하세요"
                required
                className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition-all focus:ring-2 placeholder:text-gray-300 ${
                  confirmPw ? (pwMatch ? 'border-green-400 focus:border-green-400 focus:ring-green-100' : 'border-red-300 focus:border-red-400 focus:ring-red-100') : 'border-gray-200 focus:border-primary-500 focus:ring-primary-100'
                }`}
              />
              {confirmPw && (
                <p className={`text-[11px] mt-1 font-medium ${pwMatch ? 'text-green-600' : 'text-red-400'}`}>
                  {pwMatch ? '✓ 비밀번호 일치' : '비밀번호가 일치하지 않습니다'}
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password || !confirmPw}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white text-sm font-bold rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> 가입 중...</> : '무료로 가입하기'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[11px] text-gray-400 font-medium">또는</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Login link */}
          <p className="text-center text-sm text-gray-500">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="font-bold text-primary-600 hover:text-primary-700 underline underline-offset-2">
              로그인
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-5">
          가입하면 이용약관 및 개인정보처리방침에 동의한 것으로 간주합니다.
        </p>
      </div>
    </div>
  );
}
