'use client';

import { useState, useRef } from 'react';
import { Loader2, Film, UploadCloud, CheckCircle2, ExternalLink, AlertTriangle } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

// 로컬에서 만든 영상을 올려 인스타 릴스로 발행한다.
//
// 왜 여기서 영상을 만들지 않는가: 영상 합성(ffmpeg)은 Vercel 서버리스에서
// 사실상 불가능하다. 영상은 로컬 쇼츠 도구에서 만들고, 이 화면은 발행만 맡는다.

type Phase = 'idle' | 'signing' | 'uploading' | 'publishing' | 'done' | 'pending';

export default function ReelsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [pendingId, setPendingId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = phase === 'signing' || phase === 'uploading' || phase === 'publishing';

  const pick = (f: File | null) => {
    if (!f) return;
    if (!/\.(mp4|mov)$/i.test(f.name)) {
      setError('MP4 또는 MOV 파일만 올릴 수 있습니다.');
      return;
    }
    setError('');
    setPostUrl('');
    setPendingId('');
    setPhase('idle');
    setFile(f);
  };

  const publish = async () => {
    if (!file) return;
    setError('');
    setPostUrl('');
    setProgress(0);

    try {
      // 1) 서명 URL 발급 — 파일 자체는 Vercel을 거치지 않는다(본문 4.5MB 제한)
      setPhase('signing');
      const signRes = await fetch('/api/upload-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign.error || '업로드 준비에 실패했습니다.');

      // 2) 브라우저 → Supabase 직접 업로드
      setPhase('uploading');
      const supabase = createSupabaseBrowser();
      const { error: upErr } = await supabase.storage
        .from(sign.bucket)
        .uploadToSignedUrl(sign.path, sign.token, file, { contentType: file.type || 'video/mp4' });
      if (upErr) throw new Error(`업로드 실패: ${upErr.message}`);
      setProgress(100);

      // 3) 릴스 발행
      setPhase('publishing');
      const pubRes = await fetch('/api/upload/sns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: sign.publicUrl, caption, platforms: ['instagram'] }),
      });
      const pub = await pubRes.json();
      const ig = pub.results?.instagram;

      if (ig?.success) {
        setPostUrl(ig.url || '');
        setPhase('done');
      } else if (ig?.pendingContainerId) {
        setPendingId(ig.pendingContainerId);
        setPhase('pending');
      } else {
        throw new Error(ig?.error || pub.error || '발행에 실패했습니다.');
      }
    } catch (e: any) {
      setError(e?.message || '오류가 발생했습니다.');
      setPhase('idle');
    }
  };

  const finish = async () => {
    setError('');
    setPhase('publishing');
    try {
      const res = await fetch('/api/upload/sns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finishContainerId: pendingId, caption, platforms: ['instagram'] }),
      });
      const data = await res.json();
      const ig = data.results?.instagram;
      if (!ig?.success) throw new Error(ig?.error || '발행에 실패했습니다.');
      setPostUrl(ig.url || '');
      setPhase('done');
    } catch (e: any) {
      setError(e?.message || '오류가 발생했습니다.');
      setPhase('pending');
    }
  };

  const phaseLabel = {
    signing: '업로드 준비 중...',
    uploading: '영상 올리는 중...',
    publishing: '인스타그램에 발행 중... (영상 변환에 시간이 걸립니다)',
  }[phase as 'signing' | 'uploading' | 'publishing'];

  return (
    <div className="max-w-[760px] mx-auto px-4 md:px-8 py-6 md:py-10">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">릴스 업로드</h1>
      <p className="text-sm text-gray-500 mb-6">
        만들어 둔 세로 영상을 올리면 인스타그램 릴스로 발행합니다.
      </p>

      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 mb-5">
        <p className="text-[13px] font-bold text-blue-900 mb-1.5">영상 규격</p>
        <ul className="text-[12px] text-blue-800/90 leading-relaxed list-disc pl-4 space-y-0.5">
          <li>세로 9:16 (1080×1920 권장), MP4 또는 MOV</li>
          <li>3초 ~ 15분, 300MB 이하</li>
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
        ) : (
          <>
            <UploadCloud size={28} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-semibold text-gray-700">영상 파일을 끌어다 놓거나 클릭해서 선택</p>
            <p className="text-[11px] text-gray-400 mt-1">MP4 · MOV · 최대 300MB</p>
          </>
        )}
      </div>

      <div className="mt-4">
        <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">캡션</label>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          rows={4}
          placeholder="릴스에 넣을 문구를 입력하세요. 해시태그도 함께 넣을 수 있습니다."
          className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200 resize-y"
        />
      </div>

      <button
        onClick={publish}
        disabled={!file || busy}
        className="w-full mt-4 py-3 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {busy ? <><Loader2 size={15} className="animate-spin" /> {phaseLabel}</> : '릴스로 발행하기'}
      </button>

      {phase === 'uploading' && progress > 0 && (
        <div className="h-1.5 bg-gray-100 rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-primary-500 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 mt-4">{error}</div>
      )}

      {phase === 'pending' && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 mt-4">
          <p className="text-[13px] font-bold text-amber-900 flex items-center gap-1.5 mb-1">
            <AlertTriangle size={15} /> 영상 변환이 아직 진행 중입니다
          </p>
          <p className="text-[12px] text-amber-800/90 leading-relaxed mb-3">
            영상은 이미 인스타그램에 전달됐고 변환만 남았습니다. 30초쯤 뒤 아래 버튼을 눌러 마무리하세요.
            (전달된 영상은 24시간 안에 발행하면 됩니다)
          </p>
          <button
            onClick={finish}
            className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-300 active:scale-[0.98] transition-colors"
          >
            발행 마무리
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="rounded-2xl border border-green-200 bg-green-50/70 p-4 mt-4">
          <p className="text-sm font-bold text-green-900 flex items-center gap-1.5 mb-2">
            <CheckCircle2 size={16} /> 릴스가 발행됐습니다
          </p>
          {postUrl && (
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 active:scale-[0.98] transition-colors"
            >
              인스타그램에서 보기 <ExternalLink size={13} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
