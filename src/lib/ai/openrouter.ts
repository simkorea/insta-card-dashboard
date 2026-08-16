import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || "",
  baseURL: "https://openrouter.ai/api/v1",
  // In Next.js client components/server environments, standard fetch config is usually fine.
});

export async function callAI({
  prompt,
  model = "deepseek/deepseek-v4-flash",
  system,
  maxTokens,
  temperature,
  jsonMode,
}: {
  prompt: string;
  model?: string;
  system?: string;
  maxTokens?: number;
  /**
   * 0에 가까울수록 같은 입력에 같은 답이 나온다.
   * 채점처럼 값이 흔들리면 안 되는 용도에서 0으로 준다.
   * (안 주면 모델 기본값 — 기존 호출부는 영향 없음)
   */
  temperature?: number;
  /** JSON 객체로만 답하도록 요청. 그래도 앞뒤에 설명이 붙어 나올 수 있어
   *  파싱은 extractJson 을 쓸 것. */
  jsonMode?: boolean;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY 환경변수가 없습니다");
  }

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

  if (system) {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: prompt });

  try {
    const response = await openai.chat.completions.create({
      model,
      messages,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    });

    const content = response.choices[0]?.message?.content;
    if (content === null || content === undefined) {
      throw new Error("OpenRouter로부터 빈 응답을 받았습니다.");
    }

    return content;
  } catch (error: any) {
    throw new Error(`OpenRouter 호출 실패 (${model}): ${error.message || error}`);
  }
}

export const callOpenRouter = callAI;

