import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// card-images 버킷 정리.
//
// 2026-10 에 Supabase 무료 한도(저장공간 1GB)를 넘겨 서비스(로그인·API·자동 발행)가 막혔다.
// 서버가 그리는 카드 그림이 매일 쌓이는데 지우는 코드가 없었기 때문이다.
//
// 지우는 것은 두 가지로 나눈다.
//   1) 고아 파일 — 어떤 게시물·블로그·디자인도 가리키지 않는 것(실패·중복 렌더링 등).
//      아무도 안 쓰므로 물어보지 않고 매일 자동으로 지운다. (storage_cleanup.sql: orphan_card_images)
//   2) 오래된 카드 그림 — 발행한 지 RETENTION_DAYS 일이 지난 것. 블로그·예약 목록의 그림이
//      빈 칸이 되므로 사람에게 물어보고, 원하면 ZIP 으로 내려받은 뒤에 지운다. (expired_card_images)
//
// 파일 삭제는 반드시 Storage API 로 한다 — SQL 로 storage.objects 를 지우면 파일이 남는다.
// 목록을 고르는 DB 함수는 storage_cleanup.sql 에 있다.

export const BUCKET = 'card-images';

// 발행한 카드 그림을 며칠 두었다가 "지울까요?" 하고 물을지. Vercel 환경변수
// STORAGE_RETENTION_DAYS 로 바꿀 수 있고, 없으면 7일이다.
function retentionDays(): number {
  const raw = process.env.STORAGE_RETENTION_DAYS;
  const n = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 7;
}
export const RETENTION_DAYS = retentionDays();

const PAGE = 1000;        // PostgREST 한 번에 돌려주는 최대 행 수
const REMOVE_CHUNK = 100; // Storage remove 한 번에 보낼 파일 수

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 설정이 없습니다.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function publicUrl(name: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${BUCKET}/${name}`;
}

export type StoredImage = { name: string; size_bytes: number; created_at: string };
export type ExpiredImage = StoredImage & { design_id: string | null; design_name: string | null };

const mb = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10;

/** Storage 에서 파일을 지우고, DB 에 남은 죽은 주소를 치운다. 지운 파일 수를 돌려준다. */
async function removeAndScrub(supabase: SupabaseClient, names: string[]): Promise<{ removed: number; failed: number }> {
  let removed = 0;
  let failed = 0;
  const done: string[] = [];
  for (let i = 0; i < names.length; i += REMOVE_CHUNK) {
    const chunk = names.slice(i, i + REMOVE_CHUNK);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) {
      console.error('[CardImages] 삭제 실패:', error.message);
      failed += chunk.length;
    } else {
      removed += chunk.length;
      done.push(...chunk);
    }
  }
  // 실제로 지운 것만 DB 에서 치운다 (실패한 파일의 주소는 그대로 두어야 한다)
  for (let i = 0; i < done.length; i += PAGE) {
    const { error } = await supabase.rpc('scrub_card_image_refs', { paths: done.slice(i, i + PAGE) });
    if (error) console.error('[CardImages] 죽은 주소 정리 실패:', error.message);
  }
  return { removed, failed };
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** 어디에서도 가리키지 않는 파일을 찾아(dryRun 이면 세기만) 지운다. */
export async function cleanupOrphans(opts: { dryRun?: boolean; minAgeHours?: number } = {}) {
  const supabase = client();
  const minAge = opts.minAgeHours ?? 24;
  const rows = await fetchAll<StoredImage>((from, to) =>
    supabase.rpc('orphan_card_images', { min_age_hours: minAge }).range(from, to),
  );
  const bytes = rows.reduce((s, r) => s + Number(r.size_bytes || 0), 0);
  if (opts.dryRun || rows.length === 0) {
    return { dryRun: Boolean(opts.dryRun), files: rows.length, mb: mb(bytes), removed: 0, failed: 0 };
  }
  const { removed, failed } = await removeAndScrub(supabase, rows.map(r => r.name));
  return { dryRun: false, files: rows.length, mb: mb(bytes), removed, failed };
}

/** 발행한 지 days 일이 지난 서버 카드 그림 목록. */
export async function listExpired(days = RETENTION_DAYS): Promise<ExpiredImage[]> {
  const supabase = client();
  return fetchAll<ExpiredImage>((from, to) =>
    supabase.rpc('expired_card_images', { days }).range(from, to),
  );
}

/**
 * 화면이 고른 파일을 지운다. 이름은 클라이언트가 보낸 값이므로 믿지 않고,
 * 서버가 다시 뽑은 "지워도 되는 목록"에 있는 것만 지운다.
 */
export async function deleteExpired(names: string[], days = RETENTION_DAYS) {
  const allowed = new Set((await listExpired(days)).map(r => r.name));
  const target = Array.from(new Set(names)).filter(n => allowed.has(n));
  if (target.length === 0) return { requested: names.length, removed: 0, failed: 0, skipped: names.length };
  const { removed, failed } = await removeAndScrub(client(), target);
  return { requested: names.length, removed, failed, skipped: names.length - target.length };
}

export function summarize(rows: ExpiredImage[]) {
  const bytes = rows.reduce((s, r) => s + Number(r.size_bytes || 0), 0);
  return { count: rows.length, mb: mb(bytes) };
}
