'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowRight, ExternalLink } from 'lucide-react';

type Preview = { name: string; region: string; pyeong?: number; priceText?: string; builtYear?: number };

export default function AptListPage() {
  const [raw, setRaw] = useState('');
  const [title, setTitle] = useState('');
  const [limit, setLimit] = useState(8);
  const [noteNumber, setNoteNumber] = useState('No.001');
  const [ratio, setRatio] = useState('4:5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ designId: string; slides: number; complexes: number; parsedTotal: number; preview: Preview[] } | null>(null);

  const submit = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/apt-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw, title, limit, noteNumber, ratio }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '생성에 실패했습니다.');
        return;
      }
      setResult(json);
    } catch (e: any) {
      setError(e?.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[900px] mx-auto px-4 md:px-8 py-6 md:py-10">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">단지 리스트 카드뉴스</h1>
      <p className="text-sm text-gray-500 mb-6">
        실거래가 표를 붙여넣으면 한 장에 한 단지씩, 손글씨 노트 스타일 카드뉴스를 만들어 보관함에 저장합니다.
      </p>

      {/* 가져오는 방법 안내 */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 mb-5">
        <p className="text-[13px] font-bold text-blue-900 mb-2">실거래가 표 가져오는 방법</p>
        <ol className="text-[12px] text-blue-800/90 leading-relaxed list-decimal pl-4 space-y-0.5">
          <li>
            <a
              href="https://rt.molit.go.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold hover:text-blue-900 inline-flex items-center gap-1"
            >
              국토부 실거래가 공개시스템 <ExternalLink size={11} />
            </a>
            에서 지역·기간·금액대로 조회 (로그인 필요 없음)
          </li>
          <li>결과 표를 엑셀로 내려받거나, 화면의 표를 헤더 줄까지 함께 복사</li>
          <li>아래에 붙여넣기 → 가격·평형·연식이 자동으로 채워집니다</li>
        </ol>
        <p className="text-[11px] text-blue-700/80 mt-2">
          가격·평형·연식은 붙여넣은 실거래 데이터만 사용합니다. AI는 장점 문구만 씁니다.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">카드뉴스 제목</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="예: 경기도 5억대 아파트"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">단지 개수</label>
            <input
              type="number"
              min={1}
              max={10}
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">노트 번호</label>
            <input
              value={noteNumber}
              onChange={e => setNoteNumber(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">비율</label>
            <select
              value={ratio}
              onChange={e => setRatio(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500 bg-white"
            >
              <option value="4:5">4:5</option>
              <option value="1:1">1:1</option>
              <option value="9:16">9:16</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">실거래가 표 붙여넣기</label>
          <textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            rows={9}
            placeholder={'시군구\t단지명\t전용면적(㎡)\t거래금액(만원)\t건축년도\t층\n경기도 안양시 만안구 안양동\t래미안안양메가트리아\t59.98\t56000\t2016\t12'}
            className="w-full px-3 py-3 border border-gray-200 rounded-xl text-[12px] font-mono outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200 resize-y"
          />
          <p className="text-[11px] text-gray-400 mt-1.5">
            헤더 줄(단지명·거래금액 등)을 함께 붙여넣어 주세요. 같은 단지·같은 평형은 대표 거래 1건만 사용합니다.
          </p>
        </div>

        <button
          onClick={submit}
          disabled={loading || raw.trim().length < 20}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={15} className="animate-spin" /> 만드는 중...</> : '카드뉴스 만들기'}
        </button>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
        )}

        {result && (
          <div className="rounded-2xl border border-green-200 bg-green-50/70 p-4">
            <p className="text-sm font-bold text-green-900 mb-1">
              {result.complexes}개 단지 · 총 {result.slides}장 만들었습니다
            </p>
            <p className="text-[12px] text-green-800/80 mb-3">
              표에서 {result.parsedTotal}개 단지를 읽어 상위 {result.complexes}개를 사용했습니다.
            </p>

            <div className="bg-white rounded-xl border border-green-100 divide-y divide-green-50 mb-3 overflow-hidden">
              {result.preview.map((p, i) => (
                <div key={i} className="px-3 py-2 text-[12px] flex items-baseline gap-2">
                  <span className="font-bold text-gray-800">{i + 1}. {p.name}</span>
                  <span className="text-gray-500">
                    {[p.region, p.pyeong && `전용 ${p.pyeong}평`, p.priceText, p.builtYear && `${p.builtYear}년식`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              ))}
            </div>

            <Link
              href={`/cardnews/editor?id=${result.designId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 active:scale-[0.98] transition-colors"
            >
              에디터에서 확인하고 다듬기 <ArrowRight size={13} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
