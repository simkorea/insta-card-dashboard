import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 여러 카드뉴스를 한꺼번에 예약한다.
//
// 왜 필요한가: 만들어 놓고 안 올린 것이 37개 쌓여 있었다. 하나씩 올리는
// 것으로는 줄지 않는다. 골라서 며칠에 걸쳐 줄을 세워 둔다.
//
// 이미지는 여기서 만들지 않는다. 크론에는 브라우저가 없어 카드를 그릴 수
// 없으므로, 예약을 누르는 쪽(브라우저)에서 이미 캡처·업로드를 마친 공개
// URL을 받아 넣는다. 크론은 slide_image_urls 만 보고 발행한다.

export const maxDuration = 60;

type Item = {
  designId: string;
  designName: string;
  imageUrls: string[];
  caption?: string;
  hashtags?: string[];
  scheduledAt: string;
};

export async function POST(request: NextRequest) {
  try {
    const { items } = (await request.json()) as { items: Item[] };
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '예약할 항목이 없습니다.' }, { status: 400 });
    }
    // 한 번에 다섯 개까지. 브라우저가 캡처를 감당할 수 있는 선이다.
    if (items.length > 5) {
      return NextResponse.json({ error: '한 번에 5개까지 예약할 수 있습니다.' }, { status: 400 });
    }

    const bad = items.find(
      it => !it.designId || !Array.isArray(it.imageUrls) || it.imageUrls.length === 0 || !it.scheduledAt
    );
    if (bad) {
      return NextResponse.json(
        { error: `'${bad.designName || bad.designId}'의 그림이나 예약 시각이 비어 있습니다.` },
        { status: 400 },
      );
    }
    // 인스타는 공개 URL만 받는다 — data URL이 섞이면 발행 시각에 조용히 실패한다
    const notPublic = items.find(it => it.imageUrls.some(u => !String(u).startsWith('http')));
    if (notPublic) {
      return NextResponse.json(
        { error: `'${notPublic.designName}'의 그림이 공개 주소가 아닙니다.` },
        { status: 400 },
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Supabase 설정이 없습니다.' }, { status: 500 });
    }
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const rows = items.map(it => ({
      design_id: it.designId,
      design_name: it.designName,
      thumbnail_url: it.imageUrls[0],
      slide_image_urls: it.imageUrls,
      caption: it.caption || '',
      hashtags: it.hashtags || [],
      scheduled_at: it.scheduledAt,
      status: 'pending',
    }));

    const { data, error } = await supabase.from('scheduled_posts').insert(rows).select('id, scheduled_at');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, count: data?.length ?? 0, posts: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '알 수 없는 오류' }, { status: 500 });
  }
}
