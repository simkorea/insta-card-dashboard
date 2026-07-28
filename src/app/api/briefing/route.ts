import { callAI } from "@/lib/ai/openrouter";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 300; // 5분, Vercel Pro 기준

function cleanText(text: string): string {
  return text
    .replace(/<!\[CDATA\[/gi, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

type NewsItem = { title: string; link: string; description: string };

// 국토교통부 RSS(https://www.molit.go.kr/rss/rss.jsp)는 2026-07 무렵부터 자기 자신으로
// 무한 307 리다이렉트를 돌려주어 사실상 폐기됨 → 매번 타임아웃만 소모해서 제거했다.
const RSS_SOURCES = [
  { label: "연합뉴스 경제", url: "https://www.yna.co.kr/rss/economy.xml" },
  { label: "JTBC 경제", url: "https://fs.jtbc.co.kr/RSS/economy.xml" },
  { label: "동아일보 경제", url: "https://rss.donga.com/economy.xml" },
];

const RSS_TIMEOUT_MS = 15000; // 예전엔 6초였는데 크론(콜드 스타트) 때 자주 끊겼다
const RSS_RETRIES = 2;

async function fetchRssItems(url: string, label: string): Promise<NewsItem[]> {
  for (let attempt = 1; attempt <= RSS_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
        signal: AbortSignal.timeout(RSS_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`상태코드 ${res.status}`);

      const xmlText = await res.text();
      const items: NewsItem[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match: RegExpExecArray | null;
      while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemContent = match[1];
        const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        if (!titleMatch) continue;
        const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/i);
        const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        items.push({
          title: cleanText(titleMatch[1]),
          link: linkMatch ? cleanText(linkMatch[1]) : "",
          description: descMatch ? cleanText(descMatch[1]) : "",
        });
      }
      console.log(`[Briefing] ${label}: ${items.length}건 수집 (시도 ${attempt})`);
      return items;
    } catch (e: any) {
      console.warn(`[Briefing] ${label} 수집 실패 (시도 ${attempt}/${RSS_RETRIES}): ${e.message}`);
      if (attempt < RSS_RETRIES) await new Promise(r => setTimeout(r, 1500));
    }
  }
  return [];
}

export async function GET() {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 정의되지 않았습니다. .env.local 설정을 확인해주세요.");
    }
    // 1. 부동산 뉴스 RSS 수집 (국토교통부 + 연합뉴스 경제 fallback)
    const KEYWORDS = ["부동산", "주택", "아파트", "분양", "토지", "건설", "청약", "전세", "월세", "공시가격", "재건축", "재개발", "임대", "주거", "토지거래허가구역", "미분양", "집값", "매매가", "입주"];
    const EXCLUDE_KEYWORDS = ["공모주", "유상증자", "코스피", "코스닥", "증시", "주가"];

    // 여러 소스를 병렬로 받아온다. 하나가 죽어도 나머지로 브리핑이 나오도록.
    const collected = (await Promise.all(RSS_SOURCES.map(src => fetchRssItems(src.url, src.label)))).flat();
    console.log(`[Briefing] 전체 수집 ${collected.length}건`);

    const newsItems: NewsItem[] = [];
    for (const item of collected) {
      const hasKeyword = KEYWORDS.some(k => item.title.includes(k) || item.description.includes(k));
      const hasExclude = EXCLUDE_KEYWORDS.some(k => item.title.includes(k));
      if (!hasKeyword || hasExclude) continue;
      if (newsItems.some(n => n.title === item.title)) continue;
      newsItems.push(item);
    }
    console.log(`[Briefing] 부동산 키워드 매칭 ${newsItems.length}건`);

    // 부동산 기사가 너무 적으면 일반 경제 기사로 최소 5건까지 보강
    if (newsItems.length < 5) {
      for (const item of collected) {
        if (newsItems.length >= 5) break;
        if (!newsItems.some(n => n.title === item.title)) newsItems.push(item);
      }
      console.log(`[Briefing] 보강 후 총 ${newsItems.length}건`);
    }

    // 수집이 전부 실패했으면 여기서 멈춘다.
    // 예전에는 "뉴스가 없습니다" 행을 그대로 저장해서, 대시보드가 마지막 정상 브리핑 대신
    // 빈 브리핑을 보여주는 바람에 며칠째 뉴스가 안 보이는 것처럼 됐다.
    if (newsItems.length === 0) {
      console.error("[Briefing] 모든 RSS 소스 수집 실패 — 기존 브리핑을 덮어쓰지 않고 종료");
      return NextResponse.json(
        { success: false, error: "뉴스 소스를 한 곳도 읽지 못했습니다. 기존 브리핑을 유지합니다." },
        { status: 503 }
      );
    }

    console.log(`[Briefing] 최종 요약 대상 뉴스 개수: ${newsItems.length}건`);
    newsItems.forEach((item, idx) => console.log(`[뉴스 ${idx + 1}] ${item.title}`));

    // 2. OpenRouter API를 통한 뉴스 요약 생성
    let newsSummary = "";
    const newsPrompt = `아래는 오늘자 국내 부동산·경제 뉴스 목록입니다.
주요 정책 변화나 시장 이슈를 중심으로 핵심 포인트를 격식 있고 읽기 쉬운 한글 리포트 형식으로 요약해 주세요.
각 항목별로 요약과 함께 짧은 시사점을 포함해 주세요.

뉴스 목록:
${newsItems.map((item, idx) => `[뉴스 ${idx + 1}] ${item.title}\n요약: ${item.description}`).join("\n\n")}`;

    const MAX_AI_RETRIES = 3;
    let lastAiError: any = null;
    for (let attempt = 1; attempt <= MAX_AI_RETRIES; attempt++) {
      try {
        newsSummary = await callAI({
          prompt: newsPrompt,
          model: "deepseek/deepseek-v4-flash",
          system: "당신은 부동산 정책 및 시장 분석을 전문으로 하는 금융 애널리스트 비서입니다.",
        });
        lastAiError = null;
        break;
      } catch (aiError: any) {
        lastAiError = aiError;
        console.warn(`[Briefing] AI 요약 생성 실패 (시도 ${attempt}/${MAX_AI_RETRIES}):`, aiError.message);
        if (attempt < MAX_AI_RETRIES) await new Promise(r => setTimeout(r, 3000));
      }
    }

    // 요약에 실패하면 에러 문구를 브리핑으로 저장하지 않는다 (기존 정상 브리핑 유지)
    if (lastAiError || !newsSummary.trim()) {
      console.error("[Briefing] AI 요약 생성 최종 실패:", lastAiError?.message);
      return NextResponse.json(
        { success: false, error: `AI 요약 생성 실패로 브리핑을 저장하지 않았습니다. (${lastAiError?.message || "빈 응답"})` },
        { status: 503 }
      );
    }

    // 3. Meta 광고 성과 수집 (TODO Stub 데이터 대체)
    // KST 시간 기준으로 어제 날짜 계산 (UTC + 9)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstTime = new Date(now.getTime() + kstOffset);
    const yesterday = new Date(kstTime);
    yesterday.setDate(kstTime.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0]; // YYYY-MM-DD

    // TODO: Meta Ads API 연동 구현 필요 (계정 ID: 538343246814531)
    // Meta Graph API에 어제 날짜(dateStr) 기준 광고 성과 지표(Impressions, Clicks, Spend, Leads)를 조회하는 로직 삽입 위치.
    const adPerformance = {
      accountId: "538343246814531",
      date: dateStr,
      impressions: 12480, // 노출수
      clicks: 412,        // 클릭수
      spend: 68500,       // 지출액 (원)
      leads: 14,          // 리드수
      ctr: 0.033,         // 클릭률 (CTR)
      cpc: 166,           // 클릭당 비용 (CPC)
      cpl: 4892,          // 리드당 비용 (CPL)
    };

    // 4. Supabase briefings 테이블에 저장
    const fullReport = `# 일일 종합 브리핑 요약 (${dateStr})

## 1. 부동산 뉴스 분석 브리핑
${newsSummary}

## 2. 소셜 광고 성과 리포트 (Meta Ads)
* **광고 계정 ID:** ${adPerformance.accountId}
* **노출수:** ${adPerformance.impressions.toLocaleString()} 회
* **클릭수:** ${adPerformance.clicks.toLocaleString()} 회
* **지출액:** ${adPerformance.spend.toLocaleString()} 원
* **획득 리드:** ${adPerformance.leads.toLocaleString()} 건
* **CTR (클릭률):** ${(adPerformance.ctr * 100).toFixed(2)}%
* **CPL (리드단가):** ${adPerformance.cpl.toLocaleString()} 원`;

    const { data: dbData, error: dbError } = await supabase
      .from("briefings")
      .insert({
        date: dateStr,
        real_estate_summary: newsSummary,
        ad_performance: adPerformance,
        full_report: fullReport,
        // 요약 전 원본 뉴스도 함께 저장 — 카드뉴스 초안이 "뉴스 1건 = 카드 1장"으로
        // 만들려면 요약문이 아니라 개별 기사가 필요하다
        news_items: newsItems.slice(0, 20),
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`Supabase Insert 에러: ${dbError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "일일 브리핑이 성공적으로 생성되어 저장되었습니다.",
      data: dbData,
    });
  } catch (error: any) {
    console.error("[Briefing] 크론 작업 처리 중 실패:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown Error",
      },
      { status: 500 }
    );
  }
}
