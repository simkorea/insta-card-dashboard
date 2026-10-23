import { createClient } from '@supabase/supabase-js';

// 대표가 승인한 현장 근거(site_facts). 로컬 볼트의 승인 소재집을 scripts/sync-sites.mjs 로 올려둔 것이다.
// 헌법: 광고 문구는 이 자료와 공고문에만 근거한다 — 자료에 없는 숫자·혜택을 만들지 않는다.

export type SiteFacts = { slug: string; name: string; facts: Record<string, unknown>; body_md: string };

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 설정이 없습니다.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function listSites(): Promise<Pick<SiteFacts, 'slug' | 'name'>[]> {
  const { data, error } = await client().from('site_facts').select('slug,name').order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSite(slug: string): Promise<SiteFacts | null> {
  const { data, error } = await client().from('site_facts').select('slug,name,facts,body_md').eq('slug', slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** 프롬프트에 넣을 근거 전문. */
export function factsBlock(s: SiteFacts): string {
  const head = Object.entries(s.facts).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  return `[현장 근거 — 대표 승인 자료]\n${head}\n\n${s.body_md}`;
}

// 숫자는 단위까지 붙여 비교한다. 단위 없이 비교하면 "3%"가 자료의 "3BL" 같은 데서 우연히 통과한다.
const numbersIn = (t: string) =>
  (t.match(/\d[\d,.]*\s?(?:%|억|만|원|세대|층|동|㎡|m|년|개월|일|분|평|호|BL)?/g) ?? [])
    .map(n => n.replace(/[,\s]/g, '').replace(/\.$/, ''));

/** 글 속 숫자 중 근거에 없는 것. 비어 있어야 통과. (예: "5% 할인"이 자료에 없으면 걸러낸다) */
export function unknownNumbers(text: string, s: SiteFacts): string[] {
  const known = new Set(numbersIn(factsBlock(s)));
  return Array.from(new Set(numbersIn(text))).filter(n => !known.has(n));
}
