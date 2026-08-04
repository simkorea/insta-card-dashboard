'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, Film, UploadCloud, CheckCircle2, ExternalLink, AlertTriangle, XCircle } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

// 로컬에서 만든 영상을 올려 쇼츠·릴스로 발행한다.
//
// 왜 여기서 영상을 만들지 않는가: 영상 합성(ffmpeg)은 Vercel 서버리스에서
// 사실상 불가능하다. 영상은 로컬 쇼츠 도구에서 만들고, 이 화면은 발행만 맡는다.

type Phase = 'idle' | 'signing' | 'uploading' | 'publishing' | 'done';

interface PlatformResult {
  success: boolean;
  url?: string;
  error?: string;
  pendingContainerId?: string;  // 인스타: 변환이 안 끝나 미뤄둔 컨테이너
  pendingPublishId?: string;    // 틱톡: 처리 중인 게시
  note?: string;                // 요청과 다르게 처리된 부분 알림
}

const PLATFORMS = [
  { id: 'instagram', label: '인스타그램 릴스', hint: '세로 9:16 · 3초~15분' },
  { id: 'youtube', label: '유튜브 쇼츠', hint: '세로 9:16 · 3분 이하면 쇼츠로 분류' },
  { id: 'tiktok', label: '틱톡', hint: '세로 9:16 · 문구가 게시글로 들어갑니다' },
] as const;

const PRIVACY = [
  { value: 'public', label: '공개' },
  { value: 'unlisted', label: '일부 공개(링크가 있는 사람만)' },
  { value: 'private', label: '비공개' },
] as const;

export default function ReelsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
  const [selected, setSelected] = useState<string[]>(['instagram']);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [results, setResults] = useState<Record<string, PlatformResult>>({});
  // 업로드한 영상 주소. 인스타 마무리 발행이나 재시도 때 다시 올리지 않으려고 들고 있는다.
  const [uploadedUrl, setUploadedUrl] = useState('');
  // 영상 생성 화면에서 넘어온 경우 파일 대신 이름만 보여준다.
  const [handedOverName, setHandedOverName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 영상 생성 화면이 ?video=... 로 넘겨준다. 이미 저장소에 올라가 있으므로
  // 파일을 다시 고를 필요가 없다.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const v = q.get('video');
    if (!v) return;
    setUploadedUrl(v);
    setHandedOverName(q.get('name') || '영상 생성에서 만든 영상');
  }, []);

  const busy = phase === 'signing' || phase === 'uploading' || phase === 'publishing';
  const wantsYoutube = selected.includes('youtube');
  const wantsTiktok = selected.includes('tiktok');
  const needsPrivacy = wantsYoutube || wantsTiktok;
  const hasVideo = Boolean(file || uploadedUrl);
  // 인스타는 WebM을 받지 않는다. 영상 생성이 MP4를 못 만든 브라우저에서 넘어올 수 있다.
  const isWebm = /\.webm(\?|$)/i.test(uploadedUrl) || /\.webm$/i.test(file?.name || '');
  const igBlocked = isWebm && selected.includes('instagram');
  const canPublish =
    hasVideo && selected.length > 0 && !igBlocked && (!wantsYoutube || title.trim().length > 0);

  const toggle = (id: string) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));

  const pick = (f: File | null) => {
    if (!f) return;
    if (!/\.(mp4|mov)$/i.test(f.name)) {
      setError('MP4 또는 MOV 파일만 올릴 수 있습니다.');
      return;
    }
    setError('');
    setResults({});
    setUploadedUrl('');
    setHandedOverName('');
    setPhase('idle');
    setFile(f);
  };

  /** 파일을 Supabase에 올리고 공개 주소를 돌려준다. 이미 올렸으면 그대로 쓴다. */
  const ensureUploaded = async (): Promise<string> => {
    if (uploadedUrl) return uploadedUrl;
    if (!file) throw new Error('영상 파일이 없습니다.');

    // 서명 URL 발급 — 파일 자체는 Vercel을 거치지 않는다(본문 4.5MB 제한)
    setPhase('signing');
    const signRes = await fetch('/api/upload-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
    });
    const sign = await signRes.json();
    if (!signRes.ok) throw new Error(sign.error || '업로드 준비에 실패했습니다.');

    // 브라우저 → Supabase 직접 업로드
    setPhase('uploading');
    const supabase = createSupabaseBrowser();
    const { error: upErr } = await supabase.storage
      .from(sign.bucket)
      .uploadToSignedUrl(sign.path, sign.token, file, { contentType: file.type || 'video/mp4' });
    if (upErr) throw new Error(`업로드 실패: ${upErr.message}`);

    setUploadedUrl(sign.publicUrl);
    return sign.publicUrl as string;
  };

  const publish = async () => {
    setError('');

    // 이미 성공한 곳은 다시 보내지 않는다. 한쪽만 실패해서 다시 눌렀을 때
    // 성공했던 쪽에 같은 영상이 한 번 더 올라가면 안 된다.
    const targets = selected.filter(p => !results[p]?.success);
    if (targets.length === 0) {
      setError('선택한 곳에는 이미 모두 발행했습니다. 다시 올리려면 영상을 새로 선택해주세요.');
      return;
    }

    try {
      const publicUrl = await ensureUploaded();

      setPhase('publishing');
      const pubRes = await fetch('/api/upload/sns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: publicUrl,
          caption,
          title: title.trim(),
          privacyStatus: privacy,
          platforms: targets,
        }),
      });
      const pub = await pubRes.json();
      if (!pubRes.ok) throw new Error(pub.error || '발행에 실패했습니다.');

      setResults(prev => ({ ...prev, ...(pub.results || {}) }));
      setPhase('done');
    } catch (e: any) {
      setError(e?.message || '오류가 발생했습니다.');
      setPhase('idle');
    }
  };

  /**
   * 처리가 안 끝나 미뤄둔 발행을 이어서 진행한다.
   * 인스타는 변환이 끝나면 발행 요청을 한 번 더 보내야 하고,
   * 틱톡은 저쪽에서 알아서 게시하므로 상태만 다시 물으면 된다.
   */
  const resume = async (platform: string, body: Record<string, unknown>) => {
    setError('');
    setPhase('publishing');
    try {
      const res = await fetch('/api/upload/sns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, caption, platforms: [platform] }),
      });
      const data = await res.json();
      const r = data.results?.[platform];
      if (!r) throw new Error(data.error || '응답을 받지 못했습니다.');
      setResults(prev => ({ ...prev, [platform]: r }));
      if (!r.success && !r.pendingContainerId && !r.pendingPublishId) {
        setError(r.error || '발행에 실패했습니다.');
      }
      setPhase('done');
    } catch (e: any) {
      setError(e?.message || '오류가 발생했습니다.');
      setPhase('done');
    }
  };

  const phaseLabel = {
    signing: '업로드 준비 중...',
    uploading: '영상 올리는 중...',
    publishing: '발행 중... (영상 변환에 시간이 걸립니다)',
  }[phase as 'signing' | 'uploading' | 'publishing'];

  return (
    <div className="max-w-[760px] mx-auto px-4 md:px-8 py-6 md:py-10">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">릴스·쇼츠 업로드</h1>
      <p className="text-sm text-gray-500 mb-6">
        만들어 둔 세로 영상을 올리면 선택한 플랫폼에 발행합니다.
      </p>

      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 mb-5">
        <p className="text-[13px] font-bold text-blue-900 mb-1.5">영상 규격</p>
        <ul className="text-[12px] text-blue-800/90 leading-relaxed list-disc pl-4 space-y-0.5">
          <li>세로 9:16 (1080×1920 권장), MP4 또는 MOV</li>
          <li>3초 ~ 15분, 300MB 이하 (유튜브는 200MB까지)</li>
          <li>영상 제작은 로컬 쇼츠 도구에서 하고, 완성본만 여기에 올립니다</li>
        </ul>
      </div>

      {/* 파일 선택 */}
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (!busy) pick(e.dataTransfer.files?.[0] || null); }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          busy ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-gray-300 hover:border-primary-400 cursor-pointer'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="hidden"
          onChange={e => pick(e.target.files?.[0] || null)}
        />
        {file ? (
          <div className="flex items-center justify-center gap-2.5">
            <Film size={20} className="text-primary-600 shrink-0" />
            <div className="text-left min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{file.name}</p>
              <p className="text-[11px] text-gray-500">{(file.size / 1024 / 1024).toFixed(1)}MB</p>
            </div>
          </div>
        ) : handedOverName ? (
          <div className="flex items-center justify-center gap-2.5">
            <Film size={20} className="text-primary-600 shrink-0" />
            <div className="text-left min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{handedOverName}</p>
              <p className="text-[11px] text-gray-500">영상 생성에서 넘어옴 · 이미 올라가 있습니다</p>
            </div>
          </div>
        ) : (
          <>
            <UploadCloud size={28} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-semibold text-gray-700">영상 파일을 끌어다 놓거나 클릭해서 선택</p>
            <p className="text-[11px] text-gray-400 mt-1">MP4 · MOV · 최대 300MB</p>
          </>
        )}
      </div>

      {/* 플랫폼 선택 */}
      <div className="mt-4">
        <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">올릴 곳</label>
        <div className="grid sm:grid-cols-2 gap-2">
          {PLATFORMS.map(p => {
            const on = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                disabled={busy}
                className={`text-left px-3.5 py-3 rounded-xl border-2 focus:outline-none focus:ring-2 focus:ring-primary-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  on ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className={`block text-sm font-bold ${on ? 'text-primary-700' : 'text-gray-700'}`}>{p.label}</span>
                <span className="block text-[11px] text-gray-500 mt-0.5">{p.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 유튜브·틱톡 전용 입력 — 인스타에는 제목·공개범위 개념이 없다 */}
      {needsPrivacy && (
        <div className="mt-4 rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-[12px] font-bold text-gray-700">
            {wantsYoutube && wantsTiktok ? '유튜브 · 틱톡 설정' : wantsYoutube ? '유튜브 설정' : '틱톡 설정'}
          </p>

          {wantsYoutube && (
            <div>
              <label className="text-[11px] font-semibold text-gray-600 mb-1 block">
                유튜브 제목 <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">{title.length}/100</span>
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value.slice(0, 100))}
                placeholder="예: 용인신갈 펜타원 84㎡ 실내 둘러보기"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-gray-600 mb-1 block">공개 범위</label>
            <select
              value={privacy}
              onChange={e => setPrivacy(e.target.value as typeof privacy)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200 bg-white"
            >
              {PRIVACY.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {wantsYoutube && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              유튜브는 API 기본 한도로 하루 약 6개까지만 올릴 수 있습니다. 아래 캡션이 영상 설명으로 들어갑니다.
            </p>
          )}
          {wantsTiktok && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              틱톡은 아래 캡션이 게시글 문구가 됩니다. 앱이 아직 심사 전이면 틱톡이 공개 설정을
              무시하고 &lsquo;나만 보기&rsquo;로 올립니다 — 이 경우 틱톡 앱에서 직접 공개로 바꿔주세요.
            </p>
          )}
        </div>
      )}

      <div className="mt-4">
        <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">
          캡션 {wantsYoutube && <span className="text-gray-400 font-normal">(유튜브에서는 설명)</span>}
        </label>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          rows={4}
          placeholder="영상에 넣을 문구를 입력하세요. 해시태그도 함께 넣을 수 있습니다."
          className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200 resize-y"
        />
      </div>

      <button
        onClick={publish}
        disabled={!canPublish || busy}
        className="w-full mt-4 py-3 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {busy
          ? <><Loader2 size={15} className="animate-spin" /> {phaseLabel}</>
          : selected.some(p => results[p]?.success) ? '남은 곳에 발행하기' : '발행하기'}
      </button>

      {wantsYoutube && !title.trim() && hasVideo && (
        <p className="text-[11px] text-gray-500 mt-2 text-center">유튜브에 올리려면 제목이 필요합니다.</p>
      )}
      {igBlocked && (
        <p className="text-[11px] text-red-600 mt-2 text-center">
          이 영상은 WebM이라 인스타그램에 올릴 수 없습니다. 인스타그램을 빼거나 MP4로 다시 만들어주세요.
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 mt-4">{error}</div>
      )}

      {/* 플랫폼별 결과 — 하나가 실패해도 나머지 결과는 그대로 보여준다 */}
      {Object.keys(results).length > 0 && (
        <div className="mt-4 space-y-3">
          {PLATFORMS.filter(p => results[p.id]).map(p => {
            const r = results[p.id];
            if (r.success) {
              return (
                <div key={p.id} className="rounded-2xl border border-green-200 bg-green-50/70 p-4">
                  <p className="text-sm font-bold text-green-900 flex items-center gap-1.5 mb-2">
                    <CheckCircle2 size={16} /> {p.label} 발행 완료
                  </p>
                  {r.note && (
                    <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 leading-relaxed">
                      {r.note}
                    </p>
                  )}
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 active:scale-[0.98] transition-colors"
                    >
                      바로 보기 <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              );
            }
            if (r.pendingContainerId || r.pendingPublishId) {
              const isIg = Boolean(r.pendingContainerId);
              return (
                <div key={p.id} className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-[13px] font-bold text-amber-900 flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={15} /> {p.label} — 아직 처리 중입니다
                  </p>
                  <p className="text-[12px] text-amber-800/90 leading-relaxed mb-3">
                    {isIg
                      ? '영상은 이미 전달됐고 변환만 남았습니다. 30초쯤 뒤 아래 버튼을 눌러 마무리하세요. (전달된 영상은 24시간 안에 발행하면 됩니다)'
                      : '영상은 이미 틱톡에 전달됐습니다. 틱톡이 처리를 마치면 자동으로 올라갑니다. 아래 버튼으로 상태를 다시 확인할 수 있습니다.'}
                  </p>
                  <button
                    onClick={() =>
                      isIg
                        ? resume('instagram', { finishContainerId: r.pendingContainerId })
                        : resume('tiktok', { checkPublishId: r.pendingPublishId })
                    }
                    disabled={busy}
                    className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isIg ? '발행 마무리' : '상태 확인'}
                  </button>
                </div>
              );
            }
            return (
              <div key={p.id} className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-[13px] font-bold text-red-800 flex items-center gap-1.5 mb-1">
                  <XCircle size={15} /> {p.label} 발행 실패
                </p>
                <p className="text-[12px] text-red-700 leading-relaxed">{r.error}</p>
                <p className="text-[11px] text-red-600/80 mt-2">
                  영상은 이미 올라가 있습니다. 문제를 고친 뒤 다시 누르면 업로드 없이 발행만 재시도합니다.
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
