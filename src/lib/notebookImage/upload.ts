import { createClient } from '@supabase/supabase-js';

/**
 * 생성된 노트 카드 이미지를 Supabase Storage에 올리고 공개 URL을 돌려준다.
 *
 * 파일명은 반드시 ASCII여야 한다. 예전에 단지명을 파일명에 넣었더니
 * Storage가 "Invalid key: notebook/..._안양석수하우스토리아파트_....png"로
 * 전부 거부해서, 이미지가 멀쩡히 생성됐는데도 카드에 하나도 붙지 않았다.
 */
export async function uploadNotebookImage(base64: string, index: number): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return '';

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const filename = `notebook/${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}.png`;

  const { error } = await supabase.storage
    .from('card-images')
    .upload(filename, Buffer.from(base64, 'base64'), {
      contentType: 'image/png',
      upsert: false,
    });

  if (error) {
    console.warn('[NotebookImage] 업로드 실패:', error.message);
    return '';
  }
  return supabase.storage.from('card-images').getPublicUrl(filename).data.publicUrl;
}
