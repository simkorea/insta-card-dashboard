import type { AptRecord } from './parseTransactions';
import { fetchOneMonth } from './fetchMolit';

// 아파트 타임머신 — 같은 단지가 시점별로 얼마에 거래됐는지 모은다.
//
// 실거래가 API는 한 번에 한 달치만 준다. 그래서 "3년 전 가격"을 알려면
// 그 시점 전후의 달을 각각 조회해서 같은 단지·같은 평형의 거래를 찾아야 한다.
//
// 지키는 원칙: 없는 시점은 없는 대로 둔다. 가까운 달의 값을 끌어와 채우면
// "3년 전 가격"이라고 적힌 값이 실제로는 다른 시점 거래가 되어버린다.

export type TimePoint = { label: string; yearsAgo: number };

export const TIME_POINTS: TimePoint[] = [
  { label: '현재', yearsAgo: 0 },
  { label: '1년 전', yearsAgo: 1 },
  { label: '3년 전', yearsAgo: 3 },
  { label: '5년 전', yearsAgo: 5 },
  { label: '10년 전', yearsAgo: 10 },
];

/** 시점 하나를 찾을 때 살펴볼 달의 범위(앞뒤). 넓힐수록 조회 수가 늘어난다. */
const WINDOW = 1;
/** 같은 평형으로 볼 전용면적 오차(㎡). 84.9 / 84.97 같은 표기 차이를 흡수한다. */
const AREA_TOLERANCE = 3;

export type TimeMachineCell = {
  label: string;
  found: boolean;
  priceText?: string;
  priceManwon?: number;
  dealDateText?: string;   // 2016.07.06 — 언제 거래된 값인지 반드시 함께 보여준다
  floor?: number;
};

export type TimeMachineRow = {
  name: string;
  region: string;
  areaM2?: number;
  pyeong?: number;
  builtYear?: number;
  cells: TimeMachineCell[];
  /** 현재 대비 10년 전(찾은 것 중 가장 오래된 시점) 상승률 */
  changePct?: number;
};

export type TimeMachineResult =
  | { ok: true; rows: TimeMachineRow[]; monthsQueried: number }
  | { ok: false; error: string };

const kstNow = () => new Date(Date.now() + 9 * 60 * 60 * 1000);

/** 기준월에서 n개월 전 YYYYMM */
function shiftMonth(base: Date, monthsBack: number): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - monthsBack, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 시점별로 조회할 달 목록. '현재'는 최근 3개월을 본다(이번 달은 신고 건이 적다). */
export function monthsForPoint(point: TimePoint, base = kstNow()): string[] {
  if (point.yearsAgo === 0) return [0, 1, 2].map(m => shiftMonth(base, m));
  const center = point.yearsAgo * 12;
  const out: string[] = [];
  for (let d = -WINDOW; d <= WINDOW; d++) out.push(shiftMonth(base, center + d));
  return out;
}

function sameComplex(a: string, b: string): boolean {
  const norm = (v: string) => v.replace(/\s|\(|\)|[-·]/g, '');
  return norm(a) === norm(b);
}

/** 그 달 목록에서 이 단지·이 평형의 거래를 찾는다. 여러 건이면 가장 최근 것. */
function pickTrade(records: AptRecord[], name: string, areaM2?: number): AptRecord | undefined {
  const hits = records.filter(r => {
    if (!sameComplex(r.name, name)) return false;
    if (areaM2 == null || r.areaM2 == null) return true;
    return Math.abs(r.areaM2 - areaM2) <= AREA_TOLERANCE;
  });
  if (hits.length === 0) return undefined;
  // dealDateText가 "2026.06.29" 형태라 문자열 정렬로도 최신순이 된다
  return hits.sort((a, b) => (b.dealDateText || b.dealDate || '').localeCompare(a.dealDateText || a.dealDate || ''))[0];
}

export async function fetchTimeMachine(opts: {
  lawdCd: string;
  items: { name: string; areaM2?: number }[];
}): Promise<TimeMachineResult> {
  const key = process.env.MOLIT_API_KEY;
  if (!key) return { ok: false, error: 'MOLIT_API_KEY가 설정되지 않았습니다.' };
  if (opts.items.length === 0) return { ok: false, error: '단지를 하나 이상 골라주세요.' };

  const base = kstNow();
  // 시점별 달 목록을 만들고 중복은 한 번만 조회한다
  const pointMonths = TIME_POINTS.map(p => monthsForPoint(p, base));
  const allMonths = [...new Set(pointMonths.flat())];

  const fetched = await Promise.all(allMonths.map(m => fetchOneMonth(key, opts.lawdCd, m)));

  const byMonth = new Map<string, AptRecord[]>();
  let anyOk = false;
  let firstError = '';
  allMonths.forEach((m, i) => {
    const r = fetched[i];
    if (r.ok) { anyOk = true; byMonth.set(m, r.records); }
    else if (!firstError) firstError = r.error;
  });
  // 10년 전 달은 데이터가 없을 수 있다. 전부 실패했을 때만 오류로 본다.
  if (!anyOk) return { ok: false, error: firstError || '실거래가를 불러오지 못했습니다.' };

  const rows: TimeMachineRow[] = opts.items.map(item => {
    const cells: TimeMachineCell[] = TIME_POINTS.map((point, pi) => {
      const pool = pointMonths[pi].flatMap(m => byMonth.get(m) || []);
      const hit = pickTrade(pool, item.name, item.areaM2);
      if (!hit) return { label: point.label, found: false };
      return {
        label: point.label,
        found: true,
        priceText: hit.priceText,
        priceManwon: hit.priceManwon,
        dealDateText: hit.dealDateText || hit.dealDate,
        floor: hit.floor,
      };
    });

    const now = cells[0];
    // 가장 오래된 '찾은' 시점과 비교한다. 10년 전이 없으면 5년 전과 비교하고,
    // 그 사실은 화면에서 시점 라벨로 드러난다.
    const oldest = [...cells].reverse().find(c => c.found && c !== now);
    const changePct =
      now?.found && oldest?.found && now.priceManwon && oldest.priceManwon
        ? Math.round(((now.priceManwon - oldest.priceManwon) / oldest.priceManwon) * 100)
        : undefined;

    const found = cells.find(c => c.found);
    return {
      name: item.name,
      region: '',
      areaM2: item.areaM2,
      pyeong: item.areaM2 ? Math.round(item.areaM2 / 3.3058) : undefined,
      builtYear: undefined,
      cells,
      changePct,
      ...(found ? {} : {}),
    };
  });

  return { ok: true, rows, monthsQueried: allMonths.length };
}
