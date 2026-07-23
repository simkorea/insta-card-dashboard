import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenRouter } from "@/lib/ai/openrouter";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 정의되지 않았습니다. .env.local 설정을 확인해주세요.");
    }
    let briefingId: string | undefined;

    try {
      const body = await request.json();
      briefingId = body.briefingId;
    } catch {
      // Body가 없거나 JSON 파싱이 안 된 경우 최신 브리핑으로 fallback
    }

    // 1. briefings에서 해당 행 조회 (briefingId 없으면 최신 1건)
    let briefingQuery = supabase.from("briefings").select("*");

    if (briefingId) {
      briefingQuery = briefingQuery.eq("id", briefingId);
    } else {
      briefingQuery = briefingQuery.order("created_at", { ascending: false }).limit(1);
    }

    const { data: briefingData, error: briefingError } = await briefingQuery.maybeSingle();

    if (briefingError) {
      console.error("[to-blog] Supabase briefings 조회 에러:", briefingError);
      return NextResponse.json({ success: false, error: briefingError.message }, { status: 500 });
    }

    if (!briefingData) {
      return NextResponse.json(
        { success: false, error: "대상 브리핑 데이터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const targetBriefingId = briefingData.id;
    const reportContent = briefingData.full_report || briefingData.real_estate_summary;

    if (!reportContent) {
      return NextResponse.json(
        { success: false, error: "브리핑 본문(full_report / real_estate_summary)이 비어 있습니다." },
        { status: 400 }
      );
    }

    // 2. blog_posts에 briefing_id가 같은 행이 이미 있는지 확인
    const { data: existingPost, error: existingError } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("briefing_id", targetBriefingId)
      .maybeSingle();

    if (existingError) {
      console.error("[to-blog] 기존 blog_posts 확인 중 에러:", existingError);
    }

    if (existingPost) {
      console.log(`[to-blog] 이미 존재하는 briefing_id (${targetBriefingId}) - 기존 행 반환`);
      return NextResponse.json({
        success: true,
        skipped: true,
        post: existingPost,
      });
    }

    // 3. AI 호출을 위한 프롬프트 작성
    const systemPrompt = `당신은 전문 부동산 블로그 에디터입니다.
제공된 일일 부동산 브리핑 원문을 바탕으로 독자들이 읽기 쉽고 유익한 블로그 포스팅으로 재가공하세요.

[필수 요구사항]
1. 원문 브리핑의 사실 및 수치를 임의로 수정하거나 지어내지 마세요.
2. 소제목으로 명확히 구분하여 가독성이 뛰어난 글 구조를 작성하세요.
3. 본문 분량은 공백 포함 1,500자~2,500자 정도로 작성하세요.
4. 부동산에 관심 있는 일반 독자를 대상으로 차분하고 담백하며 친절한 정보 전달 톤을 유지하세요.
5. 응답은 반드시 마크다운 코드펜스(\`\`\`json ...)나 설명 문구 없이 오직 순수한 JSON 객체만 반환하세요.

[반환 JSON 스키마]
{
  "title": "35자 이내, 클릭을 부르되 과장 없는 제목",
  "meta_description": "100자 이내 요약",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"],
  "body": "블로그 본문 내용 (소제목 ## 포함)"
}`;

    const userPrompt = `아래 일일 브리핑 원문을 바탕으로 블로그 글을 작성해 주세요.

[일일 브리핑 원문]
${reportContent}`;

    // AI 호출 (callOpenRouter) - maxTokens 4000 이상 지정
    let rawResponse: string;
    try {
      rawResponse = await callOpenRouter({
        prompt: userPrompt,
        system: systemPrompt,
        model: "deepseek/deepseek-v4-flash",
        maxTokens: 4000,
      });
    } catch (aiError: any) {
      console.error("[to-blog] AI 호출 실패:", aiError);
      return NextResponse.json(
        { success: false, error: `AI 생성 실패: ${aiError.message}` },
        { status: 500 }
      );
    }

    // 4. AI 응답 정리 및 파싱
    let cleanedResponse = rawResponse.trim();
    // 앞뒤 마크다운 코드펜스 및 공백 제거
    cleanedResponse = cleanedResponse
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsedResult: {
      title?: string;
      meta_description?: string;
      tags?: string[];
      body?: string;
    };

    try {
      parsedResult = JSON.parse(cleanedResponse);
    } catch (parseError: any) {
      console.error("[to-blog] JSON 파싱 실패:", parseError.message);
      console.error("[to-blog] 원본 AI 응답:", rawResponse);
      return NextResponse.json(
        {
          success: false,
          error: `AI 응답 JSON 파싱 실패: ${parseError.message}`,
          rawResponse,
        },
        { status: 500 }
      );
    }

    if (!parsedResult.body || !parsedResult.title) {
      console.error("[to-blog] 파싱 결과 필수 필드 누락:", parsedResult);
      return NextResponse.json(
        {
          success: false,
          error: "AI 응답에 필수 필드(title, body)가 누락되었습니다.",
        },
        { status: 500 }
      );
    }

    // 5. blog_posts 테이블에 insert
    const insertPayload = {
      title: parsedResult.title.trim(),
      body: parsedResult.body,
      meta_description: parsedResult.meta_description?.trim() || null,
      tags: parsedResult.tags || [],
      topic: "부동산 브리핑",
      format: "briefing",
      briefing_id: targetBriefingId,
    };

    const { data: newPost, error: insertError } = await supabase
      .from("blog_posts")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("[to-blog] Supabase blog_posts insert 에러:", insertError);
      return NextResponse.json(
        { success: false, error: `blog_posts 저장 실패: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      skipped: false,
      post: newPost,
    });
  } catch (err: any) {
    console.error("[to-blog] 처리 중 예외 발생:", err);
    return NextResponse.json(
      { success: false, error: err.message || "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
