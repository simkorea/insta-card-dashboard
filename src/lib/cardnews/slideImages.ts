import { createClient } from '@supabase/supabase-js';
import { captureDesignSlides } from '@/lib/cardnews/captureSlides';

// 블로그 글에 붙일 카드 그림을 구한다.
//
// 화면에서 카드뉴스를 골라 블로그를 만들면 카드가 그림으로 같이 들어간다.
// 그런데 서버에서 만드는 두 길(대시보드의 '블로그까지 한 번에', 10시 자동
// 저장)은 글만 저장해서, 저장된 글을 다시 열면 이미지가 0장이었다.
//
// 이미 인스타에 올리려고 그려 둔 그림이 있으면 그걸 그대로 쓴다. 같은
// 카드를 두 번 그릴 이유가 없다 — 30초가 그냥 든다.

/** 블로그 화면(blog-generator)의 이미지 슬롯과 같은 모양이어야 한다 */
export type BlogImageSlot = {
  id: string;
  url: string;
  source: 'generate' | 'search' | 'upload' | '';
  label: string;
};

export function toBlogImageSlots(urls: string[]): BlogImageSlot[] {
  return urls.map((url, i) => ({
    id: `img_${i + 1}`,
    url: url || '',
    source: url ? ('upload' as const) : ('' as const),
    label: '',
  }));
}

/**
 * 카드뉴스 한 벌의 그림 주소를 구한다.
 *
 * 1) 이미 발행/예약하며 그려 둔 것이 있으면 그걸 쓴다 (그리지 않음)
 * 2) 없으면 서버에서 그린다
 * 3) 그리지 못하면 빈 배열 — 그림이 없다고 글까지 못 만들 이유는 없다
 */
export async function getSlideImageUrls(
  designId: string,
  budgetMs = 120_000,
): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !designId) return [];

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing } = await supabase
    .from('scheduled_posts')
    .select('slide_image_urls')
    .eq('design_id', designId)
    .not('slide_image_urls', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const reused = (existing as { slide_image_urls?: string[] } | null)?.slide_image_urls;
  if (Array.isArray(reused) && reused.length > 0) {
    console.log(`[SlideImages] ${designId} 이미 그려 둔 ${reused.length}장 재사용`);
    return reused;
  }

  const shot = await captureDesignSlides(designId, budgetMs);
  if (!shot.ok) {
    console.warn(`[SlideImages] ${designId} 그리기 실패 — 그림 없이 진행: ${shot.error}`);
    return [];
  }
  return shot.urls;
}
