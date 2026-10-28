import { createClient } from '@supabase/supabase-js';

// 최근 며칠 계속 나온 소재(예: 둔촌주공)를 찾아, 뉴스를 고를 때 뒤로 미루게 한다.
// 점수만으로 고르면 '입주'·'전세' 같은 키워드에 가점이 붙는 기사가 날마다 이겨서
// 같은 이야기가 계속 올라갔다. 올린 글의 캡션(기사 제목 목록)을 기억으로 쓴다.

const GENERIC = new Set([
  // 계정 주제어·흔한 말 — 이것들은 '같은 소재'가 아니다
  '부동산', '시장', '뉴스', '오늘', '핵심', '정리', '분양', '청약', '입주', '아파트', '단지', '전세', '월세', '매매',
  '공급', '대출', '금리', '규제', '정책', '가격', '거래', '시세', '집값', '하락', '상승', '증가', '감소', '시작', '확대',
  '전망', '발표', '진행', '예정', '기준', '대비', '이상', '이하', '규모', '수준', '지역', '정부', '서울', '경기', '수도권',
  '전국', '가구', '세대', '관련', '이번', '지난', '올해', '내년', '최근', '소식', '이슈', '주택', '재건축', '재개발', '신축',
  '공공분양', '민간분양', '특별공급', '무순위', '미분양', '분양가', '청약통장',
  '심리', '위축', '분위기', '상황', '영향', '가능성', '추진', '확정', '완료', '주간', '일간', '선정',
]);

const PARTICLE = /(은|는|이|가|을|를|의|에|에서|으로|로|과|와|도|만)$/;

function termsOf(caption: string): Set<string> {
  const out = new Set<string>();
  for (const raw of caption.match(/[가-힣A-Za-z0-9]{3,}/g) ?? []) {
    if (/^\d+$/.test(raw)) continue;
    const t = raw.length > 3 ? raw.replace(PARTICLE, '') : raw;
    if (t.length >= 3 && !GENERIC.has(t)) out.add(t);
  }
  return out;
}

/** 최근 days 일 동안 minDays 일 이상 캡션에 나온 소재어. */
export async function recentTerms(days = 7, minDays = 3): Promise<Set<string>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Set();
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await sb.from('scheduled_posts').select('caption').eq('status', 'published').gte('scheduled_at', since);
  const count = new Map<string, number>();
  for (const row of data ?? []) {
    for (const t of termsOf(String(row.caption ?? ''))) count.set(t, (count.get(t) ?? 0) + 1);
  }
  return new Set([...count].filter(([, n]) => n >= minDays).map(([t]) => t));
}

export const isRecentTopic = (title: string, recent: Set<string>) => [...recent].some(t => title.includes(t));
