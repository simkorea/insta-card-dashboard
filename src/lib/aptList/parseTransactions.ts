// 국토부 실거래가 공개시스템(rt.molit.go.kr) 엑셀/CSV를 붙여넣으면 단지 목록으로 바꿔준다.
//
// 공공데이터포털 API 키가 없어도 쓸 수 있게 만든 경로다.
// 실거래가 공개시스템은 로그인·키 없이 엑셀을 내려받을 수 있으므로,
// 그 표를 그대로 복사해 붙여넣는 것만으로 카드뉴스를 만들 수 있다.
// (키가 준비되면 같은 AptRecord 형태로 API 조회 결과를 넣으면 된다)

export type AptRecord = {
  name: string;        // 단지명
  region: string;      // 시군구 (예: 경기도 안양시 만안구 안양동)
  areaM2?: number;     // 전용면적 ㎡
  pyeong?: number;     // 평형 (전용면적 기준 환산)
  priceManwon?: number;// 거래금액(만원)
  priceText?: string;  // "5억 6,000만 원"
  builtYear?: number;  // 건축년도
  dealDate?: string;   // 2026.06
  floor?: number;
};

// 엑셀 헤더가 조금씩 달라도 잡히도록 후보를 넉넉히 둔다
const COLS: Record<keyof Pick<AptRecord, 'name' | 'region' | 'areaM2' | 'priceManwon' | 'builtYear' | 'floor'>, string[]> = {
  name: ['단지명', '아파트', '건물명'],
  region: ['시군구', '지역', '법정동', '주소'],
  areaM2: ['전용면적', '전용면적(㎡)', '面積'],
  priceManwon: ['거래금액', '거래금액(만원)', '금액'],
  builtYear: ['건축년도', '준공년도', '사용승인'],
  floor: ['층'],
};

function normalizeHeader(h: string) {
  return h.replace(/\s|\(|\)|㎡|만원/g, '').trim();
}

function toNumber(v: string): number | undefined {
  const n = Number(String(v).replace(/[,\s"']/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/** 만원 단위 금액 → "5억 6,000만 원" */
export function formatPrice(manwon?: number): string | undefined {
  if (!manwon || manwon <= 0) return undefined;
  const eok = Math.floor(manwon / 10000);
  const rest = manwon % 10000;
  if (eok === 0) return `${manwon.toLocaleString()}만 원`;
  if (rest === 0) return `${eok}억 원`;
  return `${eok}억 ${rest.toLocaleString()}만 원`;
}

/** 전용면적(㎡) → 평형(정수). 공급면적이 아니라 전용 기준이라 실제 분양평형과 1~2평 차이날 수 있다 */
export function toPyeong(areaM2?: number): number | undefined {
  if (!areaM2 || areaM2 <= 0) return undefined;
  return Math.round(areaM2 / 3.3058);
}

function splitRow(line: string): string[] {
  // 탭 우선(엑셀 복사), 없으면 콤마
  if (line.includes('\t')) return line.split('\t');
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ',' && !inQuote) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseTransactions(raw: string): { records: AptRecord[]; warning?: string } {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { records: [], warning: '표를 알아볼 수 없습니다. 헤더 줄과 데이터 줄을 함께 붙여넣어 주세요.' };

  // 헤더 줄 찾기 — '단지명'이나 '거래금액'이 들어있는 첫 줄
  const headerIdx = lines.findIndex(l => /단지명|아파트|거래금액/.test(l));
  if (headerIdx === -1) {
    return { records: [], warning: '헤더에서 "단지명" 또는 "거래금액"을 찾지 못했습니다. 엑셀 표를 헤더 줄까지 함께 복사해 주세요.' };
  }

  const header = splitRow(lines[headerIdx]).map(normalizeHeader);
  const idxOf = (cands: string[]) =>
    header.findIndex(h => cands.some(c => h === normalizeHeader(c) || h.includes(normalizeHeader(c))));

  const iName = idxOf(COLS.name);
  const iRegion = idxOf(COLS.region);
  const iArea = idxOf(COLS.areaM2);
  const iPrice = idxOf(COLS.priceManwon);
  const iBuilt = idxOf(COLS.builtYear);
  const iFloor = idxOf(COLS.floor);

  if (iName === -1) {
    return { records: [], warning: '"단지명" 열을 찾지 못했습니다.' };
  }

  // 같은 단지·같은 평형은 가장 최근(=아래쪽) 거래 하나만 남긴다
  const map = new Map<string, AptRecord>();
  for (const line of lines.slice(headerIdx + 1)) {
    const c = splitRow(line);
    const name = (c[iName] || '').replace(/["']/g, '').trim();
    if (!name) continue;

    const areaM2 = iArea >= 0 ? toNumber(c[iArea]) : undefined;
    const priceManwon = iPrice >= 0 ? toNumber(c[iPrice]) : undefined;
    const pyeong = toPyeong(areaM2);

    const rec: AptRecord = {
      name,
      region: iRegion >= 0 ? (c[iRegion] || '').replace(/["']/g, '').trim() : '',
      areaM2,
      pyeong,
      priceManwon,
      priceText: formatPrice(priceManwon),
      builtYear: iBuilt >= 0 ? toNumber(c[iBuilt]) : undefined,
      floor: iFloor >= 0 ? toNumber(c[iFloor]) : undefined,
    };

    const key = `${name}__${pyeong ?? ''}`;
    const prev = map.get(key);
    // 같은 키면 더 높은 금액(=대표성 있는 거래)을 남긴다
    if (!prev || (rec.priceManwon ?? 0) > (prev.priceManwon ?? 0)) map.set(key, rec);
  }

  const records = [...map.values()].sort((a, b) => (b.priceManwon ?? 0) - (a.priceManwon ?? 0));
  if (records.length === 0) {
    return { records: [], warning: '데이터 줄에서 단지를 찾지 못했습니다.' };
  }
  return { records };
}
