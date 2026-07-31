// Meta(Facebook) 광고 성과를 실제로 읽어온다.
//
// 왜 별도 토큰이 필요한가:
//   이 앱의 인스타그램 연동은 Instagram Login 토큰(graph.instagram.com)이라
//   광고 API에는 아예 접근하지 못한다. 실제로 시험해보니
//   "Invalid OAuth access token - Cannot parse access token"가 돌아온다.
//   광고 지표는 Facebook Graph API + ads_read 권한이 있는 토큰이라야 한다.
//
// 권장 방식: 비즈니스 관리자의 **시스템 사용자 토큰**.
//   만료가 없어서 매일 도는 크론에 적합하고, 자기 광고 계정을 읽는 것이라
//   앱 검수도 필요 없다. 발급 후 META_ADS_ACCESS_TOKEN에 넣으면 된다.
//
// 가장 중요한 원칙: **연동이 안 되면 숫자를 지어내지 않는다.**
//   예전에는 고정된 더미값(노출 12,480 / 지출 68,500원)을 매일 저장해서,
//   실제로는 모든 캠페인이 중단돼 지출이 0원인데도 화면에는 매일 광고비를
//   쓴 것처럼 보였다.

const GRAPH = 'https://graph.facebook.com/v23.0';

export type AdPerformance = {
  connected: boolean;
  accountId: string;
  date: string;              // 집계 기준일 (YYYY-MM-DD)
  reason?: string;           // connected=false일 때 사람이 읽을 이유
  impressions?: number;
  clicks?: number;
  spend?: number;            // 원
  leads?: number;
  ctr?: number;              // 0~1
  cpc?: number;
  cpl?: number;
};

/** 리드 수는 action_type에 따라 이름이 갈린다 — 폼 리드와 전환 리드를 함께 센다 */
const LEAD_ACTION_TYPES = [
  'lead',
  'leadgen_grouped',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
];

function sumLeads(actions?: { action_type: string; value: string }[]): number {
  if (!Array.isArray(actions)) return 0;
  return actions
    .filter(a => LEAD_ACTION_TYPES.includes(a.action_type))
    .reduce((sum, a) => sum + (Number(a.value) || 0), 0);
}

/**
 * 지정한 날짜(기본: 어제)의 계정 전체 광고 성과를 가져온다.
 * 토큰이 없거나 호출이 실패하면 connected:false와 이유를 돌려준다 —
 * 이 경우 호출부는 숫자를 표시하지 않아야 한다.
 */
export async function fetchAdPerformance(dateStr: string): Promise<AdPerformance> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID || '538343246814531';
  const base: AdPerformance = { connected: false, accountId, date: dateStr };

  if (!token) {
    return { ...base, reason: 'META_ADS_ACCESS_TOKEN이 설정되지 않았습니다' };
  }

  const params = new URLSearchParams({
    fields: 'impressions,clicks,spend,ctr,cpc,actions',
    time_range: JSON.stringify({ since: dateStr, until: dateStr }),
    level: 'account',
    access_token: token,
  });

  try {
    const res = await fetch(`${GRAPH}/act_${accountId}/insights?${params}`, {
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json();

    if (!res.ok || json.error) {
      const msg = json?.error?.message || `상태코드 ${res.status}`;
      console.warn('[MetaAds] 조회 실패:', msg);
      return { ...base, reason: `광고 지표를 불러오지 못했습니다 (${msg})` };
    }

    const row = json.data?.[0];
    // 그날 집행한 광고가 없으면 data가 빈 배열이다. 이건 오류가 아니라
    // "지출 0원"이 사실인 경우이므로 connected:true로 0을 그대로 보여준다.
    if (!row) {
      return {
        ...base,
        connected: true,
        impressions: 0, clicks: 0, spend: 0, leads: 0, ctr: 0, cpc: 0, cpl: 0,
      };
    }

    const impressions = Number(row.impressions) || 0;
    const clicks = Number(row.clicks) || 0;
    const spend = Math.round(Number(row.spend) || 0);
    const leads = sumLeads(row.actions);

    return {
      ...base,
      connected: true,
      impressions,
      clicks,
      spend,
      leads,
      ctr: Number(row.ctr) ? Number(row.ctr) / 100 : clicks / (impressions || 1),
      cpc: Math.round(Number(row.cpc) || (clicks ? spend / clicks : 0)),
      cpl: leads ? Math.round(spend / leads) : 0,
    };
  } catch (e: any) {
    console.warn('[MetaAds] 조회 예외:', e?.message);
    return { ...base, reason: `광고 지표 조회 중 오류 (${e?.message || '알 수 없음'})` };
  }
}

/** 브리핑 본문에 넣을 광고 섹션 텍스트 */
export function adSectionMarkdown(ad: AdPerformance): string {
  if (!ad.connected) {
    return `## 2. 소셜 광고 성과 (Meta Ads)
* 아직 연동되지 않아 이번 브리핑에는 광고 지표가 없습니다.
* 사유: ${ad.reason || '알 수 없음'}`;
  }

  if (!ad.impressions && !ad.spend) {
    return `## 2. 소셜 광고 성과 (Meta Ads) — ${ad.date} 기준
* 이 날짜에 집행된 광고가 없습니다 (지출 0원).`;
  }

  return `## 2. 소셜 광고 성과 (Meta Ads) — ${ad.date} 기준
* 광고 지표는 당일 수치가 확정되지 않아 하루 전 기준으로 집계합니다.
* **광고 계정 ID:** ${ad.accountId}
* **노출수:** ${(ad.impressions ?? 0).toLocaleString()} 회
* **클릭수:** ${(ad.clicks ?? 0).toLocaleString()} 회
* **지출액:** ${(ad.spend ?? 0).toLocaleString()} 원
* **획득 리드:** ${(ad.leads ?? 0).toLocaleString()} 건
* **CTR (클릭률):** ${((ad.ctr ?? 0) * 100).toFixed(2)}%
* **CPL (리드단가):** ${(ad.cpl ?? 0).toLocaleString()} 원`;
}
