import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 웹훅 등록 전 임시 진단용: 최근 게시물의 실제 댓글 목록을 서버에서 안전하게 조회 (토큰은 서버 밖으로 나가지 않음)
export async function GET() {
  const { data: account } = await supabase
    .from('sns_accounts')
    .select('access_token, platform_user_id')
    .eq('platform', 'instagram')
    .limit(1)
    .maybeSingle();

  if (!account?.access_token || !account.platform_user_id) {
    return NextResponse.json({ error: '연결된 인스타그램 계정이 없습니다.' }, { status: 400 });
  }

  const mediaRes = await fetch(
    `https://graph.instagram.com/v21.0/${account.platform_user_id}/media?fields=id,caption,timestamp&limit=5&access_token=${account.access_token}`
  );
  const mediaData = await mediaRes.json();
  if (mediaData.error) {
    return NextResponse.json({ error: mediaData.error.message, raw: mediaData.error }, { status: 502 });
  }

  const results = [];
  for (const media of mediaData.data ?? []) {
    const commentsRes = await fetch(
      `https://graph.instagram.com/v21.0/${media.id}/comments?fields=id,text,username,timestamp&access_token=${account.access_token}`
    );
    const commentsData = await commentsRes.json();
    results.push({
      mediaId: media.id,
      caption: (media.caption ?? '').slice(0, 40),
      comments: commentsData.data ?? [],
      commentsError: commentsData.error ?? null,
    });
  }

  return NextResponse.json({ media: results });
}
