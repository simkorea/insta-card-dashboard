'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowRight, ExternalLink, Search, ClipboardPaste } from 'lucide-react';
import { SIGUNGU, SIDO_LIST } from '@/lib/aptList/lawdCodes';

type Preview = { name: string; region: string; pyeong?: number; priceText?: string; builtYear?: number; areaM2?: number; priceManwon?: number; floor?: number };

/** 같은 단지라도 평형이 다르면 다른 카드가 되므로 둘을 합쳐 키로 쓴다 */
const keyOf = (r: Preview) => `${r.name}__${r.pyeong ?? ''}`;

/**
 * 자동으로 고를 단지를 뽑는다.
 *
 * 그냥 비싼 순 상위 N개를 잡으면 두 가지가 망가진다:
 *  (1) 큰 단지가 평형별로 여러 번 올라와 같은 단지가 반복된다.
 *      실제로 상위 8개 중 래미안안양메가트리아가 4번, 두산위브가 2번 나왔다.
 *      "TOP 8 단지"인데 서로 다른 단지가 5개뿐이면 콘텐츠로 못 쓴다.
 *  (2) 가격 상한을 걸면 상한 이하 최고가만 남아 결과가 상한선에 몰린다.
 *      7억 상한을 걸면 여러 장이 전부 "7억 원"으로 찍힌다.
 *
 * → 단지당 1개만 남기고, 가격대에 고르게 퍼지도록 고른다.
 */
function autoPick(records: Preview[], count: number, mode: 'spread' | 'top'): Preview[] {
  // 단지당 대표 1건 (가장 비싼 거래)
  const byComplex = new Map<string, Preview>();
  for (const r of records) {
    const prev = byComplex.get(r.name);
    if (!prev || (r.priceManwon ?? 0) > (prev.priceManwon ?? 0)) byComplex.set(r.name, r);
  }
  const unique = [...byComplex.values()].sort((a, b) => (b.priceManwon ?? 0) - (a.priceManwon ?? 0));

  if (mode === 'top' || unique.length <= count) return unique.slice(0, count);

  // 비싼 것부터 싼 것까지 같은 간격으로 집어 가격대가 겹치지 않게 한다
  const step = (unique.length - 1) / (count - 1);
  const out: Preview[] = [];
  for (let i = 0; i < count; i++) out.push(unique[Math.round(i * step)]);
  return out;
}

export default function AptListPage() {
  // 입력 방식: API 조회(기본) / 표 붙여넣기.
  // 붙여넣기를 남겨두는 이유 — 인증키가 죽거나 하루 한도를 넘겨도 계속 만들 수 있어야 한다.
  const [source, setSource] = useState<'api' | 'paste'>('api');
  const [sido, setSido] = useState('경기');
  const [lawdCd, setLawdCd] = useState('41171');
  const [months, setMonths] = useState(3);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [found, setFound] = useState<Preview[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // 'spread' = 가격대 고르게, 'top' = 비싼 순. 둘 다 단지 중복은 없앤다.
  const [pickMode, setPickMode] = useState<'spread' | 'top'>('spread');

  const [raw, setRaw] = useState('');
  const [title, setTitle] = useState('');
  const [limit, setLimit] = useState(8);
  const [noteNumber, setNoteNumber] = useState('No.001');
  const [ratio, setRatio] = useState('4:5');
  const [useAiImage, setUseAiImage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ designId: string; slides: number; complexes: number; parsedTotal: number; preview: Preview[]; aiImages?: number; needsReview?: { title: string; note?: string }[] } | null>(null);

  const lookup = async () => {
    setLooking(true);
    setLookupError('');
    setFound(null);
    setPicked(new Set());
    try {
      const res = await fetch('/api/apt-list/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lawdCd,
          months,
          minPrice: minPrice ? Number(minPrice) * 10000 : undefined,
          maxPrice: maxPrice ? Number(maxPrice) * 10000 : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLookupError(json.error || '조회에 실패했습니다.');
        return;
      }
      const records: Preview[] = json.records || [];
      setFound(records);
      setPicked(new Set(autoPick(records, limit, pickMode).map(keyOf)));
    } catch (e: any) {
      setLookupError(e?.message || '오류가 발생했습니다.');
    } finally {
      setLooking(false);
    }
  };

  /**
   * 고른 단지를 기존 붙여넣기 파서가 읽는 표 형식으로 바꾼다.
   * 카드 생성 경로를 하나로 유지하려는 것 — API로 왔든 붙여넣었든
   * 그 뒤 과정은 완전히 같아야 검증 부담이 늘지 않는다.
   */
  const pickedAsTable = (): string => {
    const rows = (found || []).filter(r => picked.has(keyOf(r)));
    const header = '시군구	단지명	전용면적(㎡)	거래금액(만원)	층	건축년도';
    const body = rows.map(r =>
      [r.region, r.name, r.areaM2 ?? '', r.priceManwon ?? '', r.floor ?? '', r.builtYear ?? ''].join('	')
    );
    return [header, ...body].join('\n');
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/apt-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: source === 'api' ? pickedAsTable() : raw, title, limit, noteNumber, ratio, useAiImage }),
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

      {/* 입력 방식 — API 조회가 기본, 붙여넣기는 대비책으로 남긴다 */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setSource('api')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-bold border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200 active:scale-[0.99] ${
            source === 'api' ? 'border-primary-500 bg-primary-50/50 text-primary-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
          }`}
        >
          <Search size={14} /> 지역 선택해서 불러오기
        </button>
        <button
          onClick={() => setSource('paste')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-bold border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200 active:scale-[0.99] ${
            source === 'paste' ? 'border-primary-500 bg-primary-50/50 text-primary-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
          }`}
        >
          <ClipboardPaste size={14} /> 표 붙여넣기
        </button>
      </div>

      {source === 'api' && (
        <div className="rounded-2xl border border-gray-200 p-4 mb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">시·도</label>
              <select
                value={sido}
                onChange={e => {
                  setSido(e.target.value);
                  const first = SIGUNGU.find(s => s.sido === e.target.value);
                  if (first) setLawdCd(first.code);
                }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500 bg-white"
              >
                {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">시·군·구</label>
              <select
                value={lawdCd}
                onChange={e => setLawdCd(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500 bg-white"
              >
                {SIGUNGU.filter(s => s.sido === sido).map(s => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">기간</label>
              <select
                value={months}
                onChange={e => setMonths(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500 bg-white"
              >
                <option value={1}>최근 1개월</option>
                <option value={3}>최근 3개월</option>
                <option value={6}>최근 6개월</option>
                <option value={12}>최근 1년</option>
              </select>
            </div>
            <div>
              <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">가격대 (억)</label>
              <div className="flex items-center gap-1">
                <input
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  placeholder="4"
                  inputMode="decimal"
                  className="w-full min-w-0 px-2 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500"
                />
                <span className="text-gray-400 text-sm shrink-0">~</span>
                <input
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  placeholder="7"
                  inputMode="decimal"
                  className="w-full min-w-0 px-2 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={lookup}
            disabled={looking}
            className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-400 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {looking ? <><Loader2 size={15} className="animate-spin" /> 실거래가 불러오는 중...</> : <><Search size={15} /> 실거래가 불러오기</>}
          </button>

          <p className="text-[11px] text-gray-400 mt-2">
            국토교통부 실거래가 API에서 직접 가져옵니다. 가격·평형·연식은 이 데이터만 쓰고, AI는 장점 문구만 씁니다.
          </p>

          {lookupError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 mt-3">{lookupError}</div>
          )}

          {found && found.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800 mt-3">
              조건에 맞는 거래가 없습니다. 기간을 늘리거나 가격대를 넓혀보세요.
            </div>
          )}

          {found && found.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-[12px] font-bold text-gray-700">
                  {new Set(found.map(r => r.name)).size}개 단지 ·{' '}
                  <span className="text-primary-600">{picked.size}개 선택됨</span>
                  {(() => {
                    const names = (found || []).filter(r => picked.has(keyOf(r))).map(r => r.name);
                    const dup = names.length - new Set(names).size;
                    return dup > 0 ? <span className="text-amber-600 font-semibold"> · 같은 단지 {dup}개 중복</span> : null;
                  })()}
                </p>
                <div className="flex items-center gap-1.5">
                  {/* 어떻게 고를지. 어느 쪽이든 같은 단지가 두 번 뽑히지는 않는다 */}
                  {([
                    ['spread', '가격대 고르게'],
                    ['top', '비싼 순'],
                  ] as const).map(([m, label]) => (
                    <button
                      key={m}
                      onClick={() => {
                        setPickMode(m);
                        setPicked(new Set(autoPick(found, limit, m).map(keyOf)));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200 ${
                        pickMode === m
                          ? 'border-primary-400 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={() => setPicked(new Set(autoPick(found, limit, pickMode).map(keyOf)))}
                    className="text-[11px] text-gray-500 hover:text-gray-800 underline focus:outline-none px-1"
                  >
                    {limit}개 다시 고르기
                  </button>
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
                {found.map(r => {
                  const k = keyOf(r);
                  const on = picked.has(k);
                  return (
                    <label
                      key={k}
                      className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-[12px] ${on ? 'bg-primary-50/40' : 'hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          const next = new Set(picked);
                          if (on) next.delete(k); else next.add(k);
                          setPicked(next);
                        }}
                        className="w-4 h-4 accent-primary-600 cursor-pointer shrink-0"
                      />
                      <span className="font-bold text-gray-800 shrink-0">{r.name}</span>
                      <span className="text-gray-500 truncate">
                        {[r.region, r.pyeong && `전용 ${r.pyeong}평`, r.priceText, r.builtYear && `${r.builtYear}년식`]
                          .filter(Boolean).join(' · ')}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                체크한 단지가 순서대로 카드가 됩니다. 아래에서 제목·스타일을 정하고 만들기를 누르세요.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 가져오는 방법 안내 */}
      {source === 'paste' && (
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
      )}

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

        {source === 'paste' && (
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
        )}

        {/* 카드 스타일 */}
        <div className="rounded-xl border border-gray-200 p-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={useAiImage}
              onChange={e => setUseAiImage(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary-600 cursor-pointer"
            />
            <span>
              <span className="text-[13px] font-bold text-gray-800 block">손글씨 노트 스타일로 그리기 (AI 이미지)</span>
              <span className="text-[11px] text-gray-500 leading-relaxed block mt-0.5">
                실제 노트에 펜으로 쓴 느낌으로 만듭니다. 한 장에 20~40초 걸리고, 만든 뒤
                카드에 적힌 숫자·단지명이 원본과 같은지 자동으로 대조합니다.
                끄면 기본 스타일로 빠르게 만듭니다.
              </span>
            </span>
          </label>
        </div>

        <button
          onClick={submit}
          disabled={loading || (source === 'api' ? picked.size === 0 : raw.trim().length < 20)}
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
              {result.aiImages ? ` · 손글씨 노트로 그린 장 ${result.aiImages}개` : ''}
            </p>

            {result.needsReview && result.needsReview.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 mb-3">
                <p className="text-[12px] font-bold text-amber-900 mb-1">
                  ⚠️ 아래 {result.needsReview.length}장은 숫자 대조를 통과하지 못했습니다 — 발행 전에 직접 확인해주세요
                </p>
                <ul className="text-[11px] text-amber-800/90 list-disc pl-4 space-y-0.5">
                  {result.needsReview.map((r, i) => (
                    <li key={i}>{r.title}{r.note ? ` — ${r.note}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}

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
