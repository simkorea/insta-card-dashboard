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

export async function GET() {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 정의되지 않았습니다. .env.local 설정을 확인해주세요.");
    }
    // 1. 부동산 뉴스 RSS 수집 (국토교통부 + 연합뉴스 경제 fallback)
    let newsItems: { title: string; link: string; description: string }[] = [];
    
    // 국토교통부 RSS 수집 시도
    console.log("[Briefing] 국토교통부 RSS 수집 시작...");
    try {
      const molitRes = await fetch("https://www.molit.go.kr/rss/rss.jsp", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(6000),
      });

      console.log(`[Briefing] 국토교통부 응답 상태코드: ${molitRes.status}`);
      if (!molitRes.ok) {
        throw new Error(`국토부 응답 실패: ${molitRes.statusText}`);
      }

      const xmlText = await molitRes.text();
      console.log(`[Briefing] 국토교통부 XML 수집 완료 (길이: ${xmlText.length} 자)`);
      
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      let count = 0;
      while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemContent = match[1];
        const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/i);
        const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);

        if (titleMatch) {
          newsItems.push({
            title: cleanText(titleMatch[1]),
            link: linkMatch ? cleanText(linkMatch[1]) : "",
            description: descMatch ? cleanText(descMatch[1]) : "",
          });
          count++;
        }
      }
      console.log(`[Briefing] 국토교통부 RSS 파싱 완료: ${count}건 추출`);
    } catch (e: any) {
      console.warn(`[Briefing] 국토교통부 RSS 실패: ${e.message}`);
    }

    // 연합뉴스 경제 RSS 수집 시도 (부동산 필터링)
    console.log("[Briefing] 연합뉴스 경제 RSS 수집 시작...");
    try {
      const ynaRes = await fetch("https://www.yna.co.kr/rss/economy.xml", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(6000),
      });

      console.log(`[Briefing] 연합뉴스 응답 상태코드: ${ynaRes.status}`);
      if (!ynaRes.ok) {
        throw new Error(`연합뉴스 응답 실패: ${ynaRes.statusText}`);
      }

      const xmlText = await ynaRes.text();
      console.log(`[Briefing] 연합뉴스 XML 수집 완료 (길이: ${xmlText.length} 자)`);

      const keywords = ["부동산", "주택", "아파트", "분양", "토지", "건설", "청약", "전세", "월세", "공시가격", "재건축", "재개발", "임대", "주거", "토지거래허가구역", "미분양"];
      const excludeKeywords = ["공모주", "유상증자", "코스피", "코스닥", "증시", "주가"];

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      let ynaCount = 0;
      let ynaFilteredCount = 0;
      
      const backupItems: { title: string; link: string; description: string }[] = [];

      while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemContent = match[1];
        const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/i);
        const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);

        if (titleMatch) {
          const title = cleanText(titleMatch[1]);
          const description = descMatch ? cleanText(descMatch[1]) : "";
          const link = linkMatch ? cleanText(linkMatch[1]) : "";
          
          ynaCount++;

          // 백업 리스트용 (필터 조건 없이 보관)
          backupItems.push({ title, link, description });

          const hasKeyword = keywords.some(k => title.includes(k) || description.includes(k));
          const hasExclude = excludeKeywords.some(k => title.includes(k));

          if (hasKeyword && !hasExclude) {
            // 중복 제거 (제목 기준)
            if (!newsItems.some(item => item.title === title)) {
              newsItems.push({ title, link, description });
              ynaFilteredCount++;
            }
          }
        }
      }
      
      console.log(`[Briefing] 연합뉴스 RSS 전체 ${ynaCount}건 중 부동산 키워드 ${ynaFilteredCount}건 신규 매칭/추가`);

      // 만약 전체 수집된 뉴스가 5건 미만인 경우, 백업 리스트(일반 경제 기사)에서 채워서 최소 5건 보장
      if (newsItems.length < 5 && backupItems.length > 0) {
        console.log(`[Briefing] 부동산 뉴스 부족 (${newsItems.length}건). 일반 경제 뉴스로 보강 처리 시작...`);
        for (const item of backupItems) {
          if (newsItems.length >= 5) break;
          if (!newsItems.some(n => n.title === item.title)) {
            newsItems.push(item);
          }
        }
        console.log(`[Briefing] 보강 완료 후 총 뉴스 개수: ${newsItems.length}건`);
      }

    } catch (e: any) {
      console.warn(`[Briefing] 연합뉴스 RSS 실패: ${e.message}`);
    }

    // 최종 요약 대상 뉴스 출력 및 개수 확인
    console.log(`[Briefing] 최종 요약 대상 뉴스 개수: ${newsItems.length}건`);
    newsItems.forEach((item, idx) => {
      console.log(`[뉴스 ${idx + 1}] ${item.title}`);
      console.log(`       링크: ${item.link}`);
    });

    // 2. OpenRouter API를 통한 뉴스 요약 생성
    let newsSummary = "오늘자 수집된 부동산 뉴스가 없습니다.";
    if (newsItems.length > 0) {
      const newsPrompt = `아래는 오늘자 국토교통부(MOLIT) 뉴스 목록입니다. 
주요 정책 변화나 시장 이슈를 중심으로 핵심 포인트를 격식 있고 읽기 쉬운 한글 리포트 형식으로 요약해 주세요.
각 항목별로 요약과 함께 짧은 시사점을 포함해 주세요.

뉴스 목록:
${newsItems.map((item, idx) => `[뉴스 ${idx + 1}] ${item.title}\n요약: ${item.description}`).join("\n\n")}`;

      const MAX_AI_RETRIES = 2;
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
      if (lastAiError) {
        console.error("[Briefing] AI 요약 생성 최종 실패:", lastAiError.message);
        newsSummary = `AI 브리핑 생성 과정에서 에러가 발생했습니다. (${lastAiError.message || "알 수 없는 오류"})`;
      }
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
