'use client';
import { useEffect, useState } from 'react';
import { HardDrive, Download, Trash2 } from 'lucide-react';

// 발행한 지 일주일이 지난 카드 그림을 정리할지 물어보는 카드.
//
// Supabase 무료 저장공간(1GB)이 차서 서비스가 막힌 적이 있다. 그림을 지우면 블로그 글의 그림 칸과
// 예약 목록 썸네일이 빈 칸이 되므로 마음대로 지우지 않고 물어본다. 원하면 ZIP 으로 내려받은 뒤에 지운다.
// (안 쓰는 그림은 이 카드와 상관없이 크론이 매일 알아서 지운다.)

type Group = { designId: string | null; designName: string; date: string; files: { name: string; url: string; sizeBytes: number }[] };
type Expired = { days: number; count: number; mb: number; groups: Group[] };

const HIDE_KEY = 'storage_cleanup_hidden_until';

const safe = (s: string) => s.replace(/[\s\/\\:*?"<>|]+/g, '_').slice(0, 40) || 'cardnews';

export default function StorageCleanupCard() {
  const [data, setData] = useState<Expired | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(HIDE_KEY) || 0);
      if (until > Date.now()) return;
    } catch { /* 저장소를 못 써도 카드는 보여준다 */ }
    fetch('/api/storage/expired')
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && typeof j.count === 'number') setData(j); })
      .catch(() => { /* 정리 카드가 안 떠도 대시보드는 그대로 */ });
  }, []);

  if (!data || data.count === 0) return null;

  const hideForADay = () => {
    try { localStorage.setItem(HIDE_KEY, String(Date.now() + 24 * 3600 * 1000)); } catch { /* ignore */ }
    setData(null);
  };

  const remove = async (names: string[]) => {
    const res = await fetch('/api/storage/expired', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || '삭제 실패');
    return j as { removed: number; failed: number };
  };

  const finish = (removed: number, failed: number) => {
    setMsg(`${removed}장을 지웠습니다${failed ? ` (실패 ${failed}장)` : ''}.`);
    setData(null);
  };

  const deleteOnly = async () => {
    if (!window.confirm(`${data.days}일 지난 카드 그림 ${data.count}장(${data.mb}MB)을 지울까요?\n블로그 글의 그림 칸과 예약 목록 썸네일이 빈 칸이 됩니다. 되돌릴 수 없습니다.`)) return;
    setBusy('delete');
    try {
      const r = await remove(data.groups.flatMap(g => g.files.map(f => f.name)));
      finish(r.removed, r.failed);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '삭제 실패');
    } finally { setBusy(''); }
  };

  const downloadThenDelete = async () => {
    setBusy('zip');
    setMsg('');
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const fetched: string[] = [];
      let skipped = 0;
      for (const g of data.groups) {
        const folder = zip.folder(`${g.date}_${safe(g.designName)}`)!;
        for (const f of g.files) {
          try {
            // Supabase 공개 주소는 다른 사이트에서도 읽을 수 있어 바로 받는다. 막히면 프록시로 한 번 더.
            let res = await fetch(f.url).catch(() => null);
            if (!res || !res.ok) res = await fetch(`/api/proxy-image?url=${encodeURIComponent(f.url)}`);
            if (!res.ok) throw new Error('fetch');
            const n = /_(\d+)\.(png|jpe?g)$/i.exec(f.name);
            const ext = /\.png$/i.test(f.name) ? 'png' : 'jpg';
            folder.file(`${String(n ? n[1] : fetched.length + 1).padStart(2, '0')}_${f.name.split('_')[1] || ''}.${ext}`, await res.blob());
            fetched.push(f.name);
          } catch { skipped++; }
        }
      }
      if (fetched.length === 0) throw new Error('내려받은 그림이 없어서 지우지 않았습니다.');

      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `카드뉴스_그림_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);

      // 내려받은 것만 지운다. 못 받은 그림은 서버에 그대로 둔다.
      const ok = window.confirm(
        `ZIP 파일(${fetched.length}장)이 내려받아졌는지 확인해 주세요.\n[확인]을 누르면 서버의 그림 ${fetched.length}장을 지웁니다. 되돌릴 수 없습니다.` +
        (skipped ? `\n(받지 못한 ${skipped}장은 지우지 않습니다.)` : ''),
      );
      if (!ok) { setMsg('ZIP 만 내려받았고 서버의 그림은 그대로 뒀습니다.'); return; }
      const r = await remove(fetched);
      finish(r.removed, r.failed + skipped);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '실패했습니다');
    } finally { setBusy(''); }
  };

  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <HardDrive size={15} className="text-amber-500" />
        <h2 className="text-sm font-bold text-gray-900">저장공간 정리</h2>
        <span className="text-[10px] text-gray-400">발행한 지 {data.days}일이 지난 카드 그림</span>
      </div>
      <p className="text-[12px] text-gray-600 leading-relaxed">
        <b>{data.count}장 · {data.mb}MB</b>가 쌓여 있어요. 무료 저장공간(1GB)이 차면 로그인과 자동 발행이 멈추니 주기적으로 정리해 주세요.
        지우면 블로그 글의 그림 칸과 예약 목록 썸네일이 빈 칸이 됩니다. 이미 인스타에 올라간 게시물은 그대로예요.
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={downloadThenDelete}
          disabled={!!busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.98] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={13} /> {busy === 'zip' ? '내려받는 중...' : 'ZIP 내려받고 지우기'}
        </button>
        <button
          onClick={deleteOnly}
          disabled={!!busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 active:scale-[0.98] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={13} /> {busy === 'delete' ? '지우는 중...' : '그냥 지우기'}
        </button>
        <button
          onClick={hideForADay}
          disabled={!!busy}
          className="px-3 py-2 text-[12px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          나중에
        </button>
      </div>
      {msg && <p className="text-[11px] text-gray-500 mt-2">{msg}</p>}
    </div>
  );
}
