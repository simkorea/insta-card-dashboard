import { chromium as playwrightChromium } from 'playwright-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// 카드뉴스 초안을 서버에서 그려 공개 JPEG 주소로 만든다.
//
// 인스타 발행은 공개 URL만 받는다. 지금까지 그 그림은 사람이 브라우저에서
// 캡처해 올린 것뿐이라 크론이 자동으로 올릴 수가 없었다. 이 저장소에는
// 이미 헤드리스 크롬(@sparticuz/chromium + playwright-core)이 광고 리서치에
// 쓰이고 있으므로, 같은 방식으로 /render/cardnews/<id> 를 열어 장별로 찍는다.

// 개발 PC에서는 @sparticuz/chromium 바이너리가 Linux 전용이라 실행되지 않는다.
// adLibraryScraper 와 같은 방식으로 설치된 크롬을 쓴다.
async function getExecutablePath(): Promise<string> {
  if (process.env.NODE_ENV === 'production') return await chromium.executablePath();
  const localCandidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ];
  for (const p of localCandidates) if (fs.existsSync(p)) return p;
  return await chromium.executablePath();
}

/** 배포 주소. 크론 안에서 자기 자신을 열어야 하므로 절대주소가 필요하다. */
export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

// PNG 대신 JPEG 로 저장한다. 카드 한 장이 PNG 로는 약 1.4MB 라서 하루 10장이 쌓여
// 2026-10 에 Supabase 무료 한도(1GB)를 넘겼다. 인스타는 JPEG 를 그대로 받는다.
const JPEG_QUALITY = 90;

type Supa = ReturnType<typeof createClient>;

function serviceClient(): Supa {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 설정이 없습니다.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function uploadJpeg(
  supabase: Supa,
  buffer: Buffer,
  designId: string,
  index: number,
): Promise<{ path: string; url: string }> {
  // 파일명은 ASCII 만. 한글이 섞이면 Storage 가 통째로 거부한다
  // (uploadNotebookImage 주석에 같은 사고 기록이 있다).
  // 앞부분 '<디자인ID>_' 는 저장공간 정리가 어느 디자인의 그림인지 찾는 데 쓴다.
  const safeId = designId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36);
  const path = `auto/${safeId}_${Date.now()}_${index + 1}.jpg`;

  const { error } = await supabase.storage
    .from('card-images')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`슬라이드 ${index + 1} 업로드 실패: ${error.message}`);

  return { path, url: supabase.storage.from('card-images').getPublicUrl(path).data.publicUrl };
}

export type CaptureResult = { ok: true; urls: string[] } | { ok: false; error: string };

/**
 * 초안 한 벌을 장별 JPEG 공개 주소로 바꾼다.
 *
 * @param designId card_designs 의 id
 * @param budgetMs 이 시간을 넘기면 중단한다. 크론 전체 예산을 지키기 위한 것이다.
 */
export async function captureDesignSlides(
  designId: string,
  budgetMs = 120_000,
): Promise<CaptureResult> {
  const startedAt = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, error: 'CRON_SECRET 이 없어 렌더 화면을 열 수 없습니다.' };

  const target = `${siteOrigin()}/render/cardnews/${designId}?token=${encodeURIComponent(secret)}`;

  let browser: Awaited<ReturnType<typeof playwrightChromium.launch>> | null = null;
  // 이번 실행에서 올린 파일. 도중에 실패하면 이 조각들은 쓸 데가 없으니 바로 지운다
  // (실패한 채 남은 그림이 쌓여 용량을 먹었다).
  const uploaded: string[] = [];
  let supabase: Supa | null = null;
  const discardUploaded = async () => {
    if (!supabase || uploaded.length === 0) return;
    await supabase.storage.from('card-images').remove(uploaded).catch(() => {});
  };
  try {
    supabase = serviceClient();
    const executablePath = await getExecutablePath();
    browser = await playwrightChromium.launch({
      args: process.env.NODE_ENV === 'production' ? chromium.args : [],
      executablePath,
      headless: true,
    });

    // 카드는 420x525 로 그려지고, 해상도만 여기서 올린다.
    // 2.6배 = 1092px (인스타 권장 해상도).
    const page = await browser.newPage({
      viewport: { width: 600, height: 900 },
      deviceScaleFactor: 2.6,
      locale: 'ko-KR',
    });

    await page.goto(target, { waitUntil: 'networkidle', timeout: 60_000 });

    // 글꼴을 받고 자리를 다 잡으면 CaptureSheet 가 표시를 남긴다.
    await page.waitForSelector('body[data-capture-ready="1"]', { timeout: 45_000 });

    const slides = await page.locator('[data-capture-slide]').all();
    if (slides.length === 0) return { ok: false, error: '렌더 화면에 카드가 없습니다.' };

    const urls: string[] = [];
    for (let i = 0; i < slides.length; i++) {
      if (Date.now() - startedAt > budgetMs) {
        await discardUploaded();
        return { ok: false, error: `카드를 그리다 시간이 다 됐습니다 (${i}/${slides.length}장).` };
      }
      const buf = await slides[i].screenshot({ type: 'jpeg', quality: JPEG_QUALITY });
      const up = await uploadJpeg(supabase, buf, designId, i);
      uploaded.push(up.path);
      urls.push(up.url);
    }

    console.log(`[CaptureSlides] ${designId} ${urls.length}장 (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
    return { ok: true, urls };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[CaptureSlides] 실패:', msg);
    await discardUploaded();
    return { ok: false, error: msg };
  } finally {
    await browser?.close().catch(() => {});
  }
}
