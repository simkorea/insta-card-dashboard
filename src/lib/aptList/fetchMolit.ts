import type { AptRecord } from './parseTransactions';
import { formatPrice, toPyeong } from './parseTransactions';
import { sigunguLabel } from './lawdCodes';

// 국토교통부 아파트 매매 실거래가 API (공공데이터포털).
//   https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade
//   LAWD_CD(법정동 앞5자리) + DEAL_YMD(YYYYMM)로 조회한다.
//
// 지금까지는 실거래가 공개시스템에서 표를 복사해 붙여넣는 경로만 있었다.
// 이건 그 경로를 대체하는 게 아니라 추가하는 것 — API가 죽거나 키가 없어도
// 붙여넣기로 계속 만들 수 있어야 한다.

const ENDPOINT = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';

export type MolitResult =
  | { ok: true; records: AptRecord[]; totalCount: number }
  | { ok: false; error: string };

/** XML에서 <item>…</item> 블록을 뽑는다 (이 프로젝트의 RSS 파싱과 같은 방식) */
function extractItems(xml: string): string[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
}

/**
 * 태그 값을 읽는다. 이 API는 영문 태그(aptNm, dealAmount…)와
 * 한글 태그(<아파트>, <거래금액>…) 두 형태가 모두 돌아다녀서 둘 다 받는다.
 */
function tag(block: string, ...names: string[]): string {
  for (const name of names) {
    const m = block.match(new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${name}>`, 'i'));
    if (m && m[1].trim()) return m[1].trim();
  }
  return '';
}

function num(v: string): number | undefined {
  const n = Number(v.replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function parseItems(xml: string, lawdCd: string): AptRecord[] {
  const region = sigunguLabel(lawdCd);

  return extractItems(xml)
    .map(b => {
      const name = tag(b, 'aptNm', '아파트');
      if (!name) return null;

      const areaM2 = num(tag(b, 'excluUseAr', '전용면적'));
      const priceManwon = num(tag(b, 'dealAmount', '거래금액'));
      const umd = tag(b, 'umdNm', '법정동');
      const y = tag(b, 'dealYear', '년');
      const m = tag(b, 'dealMonth', '월');

      const rec: AptRecord = {
        name,
        // 시군구 이름은 코드로 알고 있고, 응답에는 법정동만 온다 → 합쳐서 표시용 주소를 만든다
        region: [region, umd].filter(Boolean).join(' '),
        areaM2,
        pyeong: toPyeong(areaM2),
        priceManwon,
        priceText: formatPrice(priceManwon),
        builtYear: num(tag(b, 'buildYear', '건축년도')),
        dealDate: y && m ? `${y}.${String(m).padStart(2, '0')}` : undefined,
        floor: num(tag(b, 'floor', '층')),
      };
      return rec;
    })
    .filter((r): r is AptRecord => r !== null);
}

/** YYYYMM 문자열을 최근 N개월치 배열로 (오늘 포함, 최신순) */
export function recentMonths(count: number): string[] {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/**
 * 포털은 인증키를 Encoding/Decoding 두 형태로 준다.
 * Decoding 키는 인코딩해서 보내야 하고, Encoding 키는 그대로 보내야 한다.
 * 반대로 넣으면 "등록되지 않은 인증키"가 나오는데, 화면만 보고는 원인을
 * 알 수 없어 사람들이 여기서 오래 헤맨다. 어느 쪽을 넣었든 되게 두 형태를 다 시도한다.
 */
function keyVariants(key: string): string[] {
  const trimmed = key.trim();
  const looksEncoded = /%[0-9A-Fa-f]{2}/.test(trimmed);
  // 이미 인코딩된 키면 그대로 먼저, 아니면 인코딩한 걸 먼저 시도한다
  return looksEncoded
    ? [trimmed, encodeURIComponent(trimmed)]
    : [encodeURIComponent(trimmed), trimmed];
}

async function fetchOneMonth(key: string, lawdCd: string, ymd: string): Promise<MolitResult> {
  let last: MolitResult = { ok: false, error: '실거래가를 불러오지 못했습니다.' };
  for (const variant of keyVariants(key)) {
    last = await callMolit(variant, lawdCd, ymd);
    // 키 형태 문제가 아니면 더 시도할 이유가 없다
    if (last.ok || !/등록되지 않은 인증키/.test(last.error)) return last;
  }
  return last;
}

async function callMolit(serviceKey: string, lawdCd: string, ymd: string): Promise<MolitResult> {
  // serviceKey는 이미 인코딩된 값일 수 있어 직접 붙인다.
  // URLSearchParams에 넣으면 Encoding 키가 이중 인코딩돼 인증이 깨진다.
  const params = `LAWD_CD=${lawdCd}&DEAL_YMD=${ymd}&pageNo=1&numOfRows=1000&serviceKey=${serviceKey}`;

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(20000) });
    const text = await res.text();

    // 포털은 오류도 200으로 XML에 담아 돌려준다 → 본문을 봐야 한다
    const code = tag(text, 'resultCode', 'returnReasonCode');
    const msg = tag(text, 'resultMsg', 'returnAuthMsg', 'errMsg');
    if (code && !['00', '000', '0'].includes(code)) {
      return { ok: false, error: molitErrorKo(code, msg) };
    }
    if (/SERVICE_KEY_IS_NOT_REGISTERED/i.test(text)) {
      return { ok: false, error: molitErrorKo('30', '') };
    }
    if (!res.ok) return { ok: false, error: `실거래가 조회 실패 (상태코드 ${res.status})` };

    return {
      ok: true,
      records: parseItems(text, lawdCd),
      totalCount: num(tag(text, 'totalCount')) ?? 0,
    };
  } catch (e: any) {
    return { ok: false, error: `실거래가 조회 중 오류: ${e?.message || '알 수 없음'}` };
  }
}

/** 포털 오류코드를 사람이 읽을 수 있는 한국어로 */
function molitErrorKo(code: string, msg: string): string {
  const map: Record<string, string> = {
    '30': '등록되지 않은 인증키입니다. 발급 직후라면 1시간 정도 뒤에 다시 시도해주세요.',
    '31': '인증키 사용 기한이 만료되었습니다.',
    '22': '오늘 사용할 수 있는 호출 횟수를 모두 썼습니다. 내일 다시 시도해주세요.',
    '20': '해당 API에 대한 활용 신청이 승인되지 않았습니다.',
    '10': '요청 값이 잘못되었습니다.',
    '12': '폐기되었거나 없는 API입니다.',
  };
  return map[code] || `실거래가 조회 실패 (코드 ${code}${msg ? `: ${msg}` : ''})`;
}

/**
 * 지정한 시군구의 최근 N개월 실거래를 모아 온다.
 * 한 달만 보면 거래가 적은 지역은 카드가 몇 장 안 나와서 여러 달을 합친다.
 */
export async function fetchMolitTrades(opts: {
  lawdCd: string;
  months?: number;
  minPriceManwon?: number;
  maxPriceManwon?: number;
}): Promise<MolitResult> {
  const key = process.env.MOLIT_API_KEY;
  if (!key) {
    return { ok: false, error: 'MOLIT_API_KEY가 설정되지 않았습니다. 표 붙여넣기로 만들어주세요.' };
  }

  const months = recentMonths(Math.min(Math.max(opts.months ?? 3, 1), 12));
  const results = await Promise.all(months.map(m => fetchOneMonth(key, opts.lawdCd, m)));

  // 한 달이라도 성공했으면 그걸로 진행한다. 전부 실패했을 때만 오류로 처리 —
  // 이번 달은 아직 신고 건이 없어 빈 응답이 오는 경우가 흔하다.
  const failures = results.filter(r => !r.ok) as { ok: false; error: string }[];
  const successes = results.filter(r => r.ok) as { ok: true; records: AptRecord[]; totalCount: number }[];
  if (successes.length === 0) {
    return { ok: false, error: failures[0]?.error || '실거래가를 불러오지 못했습니다.' };
  }

  let records = successes.flatMap(r => r.records);

  if (opts.minPriceManwon) records = records.filter(r => (r.priceManwon ?? 0) >= opts.minPriceManwon!);
  if (opts.maxPriceManwon) records = records.filter(r => (r.priceManwon ?? 0) <= opts.maxPriceManwon!);

  // 같은 단지·같은 평형은 대표 거래 1건만 (붙여넣기 경로와 같은 규칙)
  const map = new Map<string, AptRecord>();
  for (const r of records) {
    const k = `${r.name}__${r.pyeong ?? ''}`;
    const prev = map.get(k);
    if (!prev || (r.priceManwon ?? 0) > (prev.priceManwon ?? 0)) map.set(k, r);
  }

  const deduped = [...map.values()].sort((a, b) => (b.priceManwon ?? 0) - (a.priceManwon ?? 0));
  return { ok: true, records: deduped, totalCount: records.length };
}
