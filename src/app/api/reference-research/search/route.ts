import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { searchAdLibrary } from '@/lib/referenceResearch/adLibraryScraper';
import { toKoreanError } from '@/lib/gemini';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { keyword } = await request.json();
    if (!keyword || !keyword.trim()) {
      return NextResponse.json({ error: '검색어가 필요합니다' }, { status: 400 });
    }

    const ads = await searchAdLibrary(keyword.trim());
    if (ads.length === 0) {
      return NextResponse.json({ error: '검색 결과가 없거나 메타 광고 라이브러리 접근이 일시적으로 막혔습니다. 잠시 후 다시 시도해주세요.' }, { status: 502 });
    }

    const { data, error } = await supabase
      .from('reference_ads')
      .insert(ads.map(ad => ({
        source: 'search',
        keyword: keyword.trim(),
        advertiser_name: ad.advertiserName,
        ad_text: ad.adText,
        landing_domain: ad.landingDomain,
        library_id: ad.libraryId,
        started_at: ad.startedAt,
      })))
      .select();

    if (error) throw new Error(error.message);

    return NextResponse.json({ items: data });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
