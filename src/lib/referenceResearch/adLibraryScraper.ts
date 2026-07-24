import { chromium as playwrightChromium } from 'playwright-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';

export interface ScrapedAd {
  advertiserName: string;
  adText: string;
  landingDomain: string | null;
  libraryId: string | null;
  startedAt: string | null;
}

// 로컬 개발 환경에서는 @sparticuz/chromium 바이너리가 Linux 전용이라 실행이 안 됨 —
// 개발 PC에 설치된 Chrome/Edge를 대신 사용
async function getExecutablePath(): Promise<string> {
  if (process.env.NODE_ENV === 'production') {
    return await chromium.executablePath();
  }
  const localCandidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ];
  for (const p of localCandidates) {
    if (fs.existsSync(p)) return p;
  }
  return await chromium.executablePath();
}

// Meta 광고 라이브러리는 안정적인 CSS 클래스명이 없어(난독화된 원자적 클래스) 텍스트 패턴 기반으로 파싱한다.
// "라이브러리 ID: ####" 마커를 기준으로 광고 블록을 나누는 방식 — 페이지 구조가 바뀌면 깨질 수 있음.
function parseAdLibraryText(raw: string): ScrapedAd[] {
  const lines = raw
    .split('\n')
    .map(l => l.replace(/​/g, '').trim())
    .filter(l => l.length > 0);

  const idxs: number[] = [];
  lines.forEach((l, i) => { if (/^라이브러리 ID:/.test(l)) idxs.push(i); });

  const results: ScrapedAd[] = [];

  for (let n = 0; n < idxs.length; n++) {
    const start = idxs[n];
    const regionEnd = n + 1 < idxs.length ? idxs[n + 1] : lines.length;
    const region = lines.slice(start, regionEnd);

    const libraryIdMatch = region[0].match(/라이브러리 ID:\s*(\S+)/);
    const libraryId = libraryIdMatch ? libraryIdMatch[1] : null;

    const startedLine = region.slice(1, 3).find(l => l.includes('게재 시작함'));
    const startedAt = startedLine ? startedLine.replace('에 게재 시작함', '') : null;

    const adLabelIdx = region.findIndex(l => l === '광고');
    if (adLabelIdx <= 0) continue;

    const advertiserName = region[adLabelIdx - 1];
    const after = region.slice(adLabelIdx + 1);
    const domainIdx = after.findIndex(l => /^[A-Z0-9.\-]+\.[A-Z]{2,}$/.test(l));
    const textLines = domainIdx >= 0 ? after.slice(0, domainIdx) : after.slice(0, 8);
    const adText = textLines.join(' ').slice(0, 800);
    const landingDomain = domainIdx >= 0 ? after[domainIdx] : null;

    if (advertiserName && adText) {
      results.push({ advertiserName, adText, landingDomain, libraryId, startedAt });
    }
  }

  return results;
}

// 사용자가 검색 버튼을 누를 때만 1회성으로 호출됨 — 자동 반복/대량 수집이나
// 탐지 우회(캡차 우회, IP 로테이션 등) 로직은 의도적으로 넣지 않음.
// 막히면 그냥 에러를 반환한다.
export async function searchAdLibrary(keyword: string, limit = 12): Promise<ScrapedAd[]> {
  const executablePath = await getExecutablePath();
  const baseArgs = process.env.NODE_ENV === 'production' ? chromium.args : [];
  const browser = await playwrightChromium.launch({
    args: [...baseArgs, '--disable-blink-features=AutomationControlled'],
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 1200 },
      locale: 'ko-KR',
    });

    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=KR&q=${encodeURIComponent(keyword)}`;
    let response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 첫 접속이 봇 감지로 막히면(403) 사람이 새로고침하듯 한 번만 재시도 — 그 이상 반복하지 않음
    if (response && response.status() >= 400) {
      response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);
    }

    if (response && response.status() >= 400) {
      throw new Error(`메타 광고 라이브러리 접근이 막혔습니다 (status ${response.status()})`);
    }

    const bodyText = await page.evaluate(() => document.body.innerText);
    return parseAdLibraryText(bodyText).slice(0, limit);
  } finally {
    await browser.close();
  }
}
