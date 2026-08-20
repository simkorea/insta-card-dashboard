import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import CaptureSheet from './CaptureSheet';

// 서버가 카드를 그려 가져가기 위한 화면.
//
// 왜 필요한가: 인스타 발행은 공개 PNG 주소를 받는데, 그 그림은 지금까지
// 사람이 브라우저에서 캡처해 올린 것뿐이었다. 크론에는 브라우저가 없어
// 자동 발행이 불가능했다. 이 화면을 헤드리스 크롬으로 열어 캡처한다.
//
// 사람이 볼 화면이 아니다. 로그인 없이 열려야 하므로(크론이 연다) 대신
// CRON_SECRET 토큰이 맞아야만 내용을 그린다.

export const dynamic = 'force-dynamic';

export default async function RenderCardnewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  const secret = process.env.CRON_SECRET;
  if (!secret || token !== secret) notFound();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) notFound();

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await supabase
    .from('card_designs')
    .select('pages_data')
    .eq('id', id)
    .maybeSingle();

  const pages = Array.isArray(data?.pages_data) ? data.pages_data : [];
  if (pages.length === 0) notFound();

  return <CaptureSheet pages={pages} />;
}
