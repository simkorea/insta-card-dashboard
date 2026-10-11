// 사진 배경(save_cardnews_exact 의 photoBgUrl)과 이미지 올리기(upload_image)용 — AI 없음.
//
// 이 파일은 외부 import 가 하나도 없다. 저장소·fetch 는 인자로 받는다(structural 타입).
// 그래서 scripts/test-photo-bg.mjs 가 가짜 저장소·가짜 fetch 를 넣어 Node 로 직접 테스트한다.
//
// 지키는 것
//  - 받는 주소는 허용 출처뿐이다: images.pexels.com · images.unsplash.com · 우리 Supabase card-images.
//    아무 주소나 받으면 서버가 임의의 외부 주소를 대신 내려받게 된다(SSRF).
//  - 내려받은 그림은 우리 card-images 에 다시 올려 링크를 고정한다. 외부 링크는 사라지거나 바뀐다.
//  - 파일 종류는 확장자·Content-Type 이 아니라 앞 몇 바이트(매직 넘버)로 판별한다.
//  - 리다이렉트는 따라가지 않는다(허용 출처 밖으로 새는 길을 막는다).

export const BUCKET = 'card-images';
export const PHOTO_HOSTS = ['images.pexels.com', 'images.unsplash.com'] as const;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 외부에서 내려받는 그림 한도
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // upload_image 로 받는 그림 한도(디코딩 후)
export const MAX_BASE64_CHARS = Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 8; // 디코딩 전에 거르는 상한
const FETCH_TIMEOUT_MS = 20_000;

// ── 주소 검사 ────────────────────────────────────────────────────────────────

/** 통과하면 null, 거절하면 이유(한국어). */
export function checkPhotoUrl(url: string, supabaseUrl?: string): string | null {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2000) return '주소가 비었거나 너무 깁니다(2000자 이하).';
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return '주소 형식이 올바르지 않습니다.';
  }
  if (u.protocol !== 'https:') return 'https 주소만 받습니다.';
  if (u.username || u.password) return '로그인 정보가 들어간 주소는 받지 않습니다.';
  if (u.port) return '포트가 지정된 주소는 받지 않습니다.';
  if (u.hash) return '해시(#)가 붙은 주소는 받지 않습니다.';
  // URL 파서가 정리해 버리는 %2e%2e 같은 것은 원문에서 막는다 (받는 쪽이 정리 없이 쓸 수 있다)
  if (/%2e|%2f|%5c|\\/i.test(url)) return '인코딩된 경로 문자(. / \\)가 든 주소는 받지 않습니다.';
  let path: string;
  try {
    path = decodeURIComponent(u.pathname);
  } catch {
    return '경로를 해석하지 못했습니다.';
  }
  if (path.split('/').includes('..')) return '상위 경로(..)가 든 주소는 받지 않습니다.';

  const host = u.hostname.toLowerCase();
  if ((PHOTO_HOSTS as readonly string[]).includes(host)) return null; // 쿼리(크기 옵션)는 허용

  if (supabaseUrl) {
    let origin: string | null = null;
    try {
      origin = new URL(supabaseUrl).origin;
    } catch {
      /* 아래에서 거절 */
    }
    if (origin && u.origin === origin) {
      if (u.search) return '우리 저장소 주소에는 쿼리가 붙으면 안 됩니다.';
      if (!path.startsWith(`/storage/v1/object/public/${BUCKET}/`)) return `${BUCKET} 버킷의 공개 주소가 아닙니다.`;
      return null;
    }
  }
  return `허용되지 않은 출처입니다. 받는 곳: ${PHOTO_HOSTS.join(', ')}, 우리 Supabase ${BUCKET}.`;
}

/** photoBgUrl 이 있는 장마다 검사한다. 통과하면 null. */
export function checkPhotoUrls(slides: { photoBgUrl?: string }[], supabaseUrl?: string): string | null {
  for (let i = 0; i < slides.length; i++) {
    const u = slides[i].photoBgUrl;
    if (u === undefined) continue;
    const reason = checkPhotoUrl(u, supabaseUrl);
    if (reason) return `slides[${i}].photoBgUrl: ${reason}`;
  }
  return null;
}

// ── 파일 종류 ────────────────────────────────────────────────────────────────

export type ImageKind = { ext: 'jpg' | 'png' | 'webp'; mime: 'image/jpeg' | 'image/png' | 'image/webp' };

/** 앞 몇 바이트로 jpg·png·webp 만 알아본다. 그 밖(svg·gif·html 등)은 null. */
export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

// ── 저장소(구조만 정의 — SupabaseClient 가 그대로 들어맞는다) ────────────────

export type StorageLike = {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Uint8Array,
        opts: { contentType: string; upsert: boolean }
      ): PromiseLike<{ error: { message: string } | null }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
      remove(paths: string[]): PromiseLike<unknown>;
    };
  };
};

const rand8 = () => globalThis.crypto.randomUUID().slice(0, 8);

/** 파일 이름은 ASCII 만. 한글이 섞이면 Storage 가 통째로 거부한다(captureSlides.uploadPng 와 같은 이유). */
export function safeBaseName(name: string): string {
  const base = name.replace(/\.[A-Za-z0-9]+$/, '');
  return base.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'img';
}

async function putImage(
  client: StorageLike,
  prefix: string,
  name: string,
  bytes: Uint8Array,
  kind: ImageKind,
  now: () => number
): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  const path = `${prefix}/${now()}_${rand8()}_${name}.${kind.ext}`;
  const bucket = client.storage.from(BUCKET);
  const { error } = await bucket.upload(path, bytes, { contentType: kind.mime, upsert: false });
  if (error) return { ok: false, error: `저장소 업로드 실패: ${error.message}` };
  return { ok: true, url: bucket.getPublicUrl(path).data.publicUrl, path };
}

// ── 외부 그림을 내려받아 우리 저장소에 고정 ──────────────────────────────────

export type PinResult =
  | { ok: true; url: string; path: string; bytes: number; contentType: string }
  | { ok: false; error: string };

export async function fetchAndPinPhoto(opts: {
  client: StorageLike;
  url: string;
  index?: number; // 파일 이름에 붙는 장 번호(0부터)
  fetchImpl?: typeof fetch;
  now?: () => number;
  maxBytes?: number;
  timeoutMs?: number;
}): Promise<PinResult> {
  const { client, url, index = 0, fetchImpl = fetch, now = Date.now, maxBytes = MAX_PHOTO_BYTES, timeoutMs = FETCH_TIMEOUT_MS } = opts;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `그림을 내려받지 못했습니다: ${msg}` };
  }
  if (res.status >= 300 && res.status < 400) return { ok: false, error: '리다이렉트 응답이라 받지 않았습니다(허용 출처 밖으로 새는 것을 막음).' };
  if (!res.ok) return { ok: false, error: `그림을 내려받지 못했습니다(HTTP ${res.status}).` };

  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > maxBytes) return { ok: false, error: `그림이 너무 큽니다(${Math.round(declared / 1024 / 1024)}MB, 한도 ${maxBytes / 1024 / 1024}MB).` };

  // 선언된 크기를 믿지 않고 읽으면서 센다
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body?.getReader();
  if (!reader) return { ok: false, error: '응답 본문이 없습니다.' };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, error: `그림이 너무 큽니다(한도 ${maxBytes / 1024 / 1024}MB).` };
      }
      chunks.push(value);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `그림을 읽다 실패했습니다: ${msg}` };
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.length;
  }

  const kind = sniffImage(bytes);
  if (!kind) return { ok: false, error: '그림 파일이 아닙니다(jpg·png·webp 만 받습니다).' };

  const put = await putImage(client, 'mcp-bg', `s${index + 1}`, bytes, kind, now);
  if (!put.ok) return put;
  return { ok: true, url: put.url, path: put.path, bytes: total, contentType: kind.mime };
}

/** 올리다 중간에 실패했을 때 이미 올린 것을 지운다(실패해도 무시). */
export async function removePinned(client: StorageLike, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await client.storage.from(BUCKET).remove(paths);
  } catch {
    /* 정리는 최선만 */
  }
}

// ── search_images: 검색 결과 → 돌려줄 모양 ───────────────────────────────────
//
// 원본: src/app/api/pexels/route.ts · src/app/api/images/search/route.ts (fetch 부분은 route.ts 에서
// 같은 주소·같은 헤더로 부른다). 카드가 세로형(4:5)이라 둘 다 orientation=portrait 로 찾는다.

export type FoundImage = { url: string; thumb: string; width: number; height: number; credit: string };

const allowedPhotoHost = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && (PHOTO_HOSTS as readonly string[]).includes(x.hostname.toLowerCase());
  } catch {
    return false;
  }
};

type PexelsJson = { photos?: { photographer?: string; width?: number; height?: number; src?: { large2x?: string; large?: string; medium?: string } }[] };
export function mapPexelsPhotos(json: PexelsJson): FoundImage[] {
  const out: FoundImage[] = [];
  for (const p of json.photos ?? []) {
    const url = p.src?.large2x || p.src?.large || '';
    if (!allowedPhotoHost(url)) continue; // save_cardnews_exact 가 받을 수 있는 주소만 돌려준다
    out.push({
      url,
      thumb: p.src?.medium || url,
      width: p.width ?? 0,
      height: p.height ?? 0,
      credit: `Photo by ${p.photographer || 'Unknown'} on Pexels`,
    });
  }
  return out;
}

type UnsplashJson = { results?: { width?: number; height?: number; urls?: { regular?: string; small?: string }; user?: { name?: string } }[] };
export function mapUnsplashPhotos(json: UnsplashJson): FoundImage[] {
  const out: FoundImage[] = [];
  for (const p of json.results ?? []) {
    const url = p.urls?.regular || '';
    if (!allowedPhotoHost(url)) continue;
    out.push({
      url,
      thumb: p.urls?.small || url,
      width: p.width ?? 0,
      height: p.height ?? 0,
      credit: `Photo by ${p.user?.name || 'Unknown'} on Unsplash`,
    });
  }
  return out;
}

// ── upload_image: base64 로 받은 그림 ────────────────────────────────────────

export type DecodedUpload =
  | { ok: true; bytes: Uint8Array; kind: ImageKind; safeName: string }
  | { ok: false; error: string };

export function decodeUploadImage(filename: string, base64: string): DecodedUpload {
  const extMatch = /\.(png|jpe?g|webp)$/i.exec(filename);
  if (!extMatch) return { ok: false, error: '파일 이름은 .png · .jpg · .jpeg · .webp 로 끝나야 합니다.' };
  const declared = extMatch[1].toLowerCase() === 'jpeg' ? 'jpg' : extMatch[1].toLowerCase();

  // data:image/png;base64, 접두사가 붙어 와도 받는다
  const b64 = base64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s+/g, '');
  if (b64.length === 0) return { ok: false, error: 'base64 내용이 비었습니다.' };
  if (b64.length > MAX_BASE64_CHARS) return { ok: false, error: `그림이 너무 큽니다(한도 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB).` };
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 === 1) return { ok: false, error: 'base64 형식이 올바르지 않습니다.' };

  const bytes = new Uint8Array(Buffer.from(b64, 'base64'));
  if (bytes.length === 0) return { ok: false, error: '디코딩 결과가 비었습니다.' };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: `그림이 너무 큽니다(${(bytes.length / 1024 / 1024).toFixed(1)}MB, 한도 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB).` };

  const kind = sniffImage(bytes);
  if (!kind) return { ok: false, error: '그림 파일이 아닙니다(png·jpg·webp 만 받습니다).' };
  if (kind.ext !== declared) return { ok: false, error: `파일 이름은 .${declared} 인데 내용은 ${kind.ext} 입니다. 이름을 맞춰 주세요.` };

  return { ok: true, bytes, kind, safeName: safeBaseName(filename) };
}

export async function uploadMcpImage(opts: {
  client: StorageLike;
  bytes: Uint8Array;
  kind: ImageKind;
  safeName: string;
  now?: () => number;
}): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  return putImage(opts.client, 'mcp-uploads', opts.safeName, opts.bytes, opts.kind, opts.now ?? Date.now);
}
