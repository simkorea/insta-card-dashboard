import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { toKoreanError } from '@/lib/gemini';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from('reference_ads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  return NextResponse.json({ items: data });
}

// 직접 캡처해서 업로드한 경쟁사 광고/카드뉴스 등록
export async function POST(request: NextRequest) {
  try {
    const { advertiserName, adText, mediaUrl } = await request.json();
    if (!mediaUrl && !adText) {
      return NextResponse.json({ error: '이미지나 설명 중 하나는 입력해주세요' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('reference_ads')
      .insert({
        source: 'upload',
        advertiser_name: advertiserName || null,
        ad_text: adText || null,
        media_url: mediaUrl || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ item: data });
  } catch (error: any) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
