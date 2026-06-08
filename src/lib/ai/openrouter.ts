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
}: {
  prompt: string;
  model?: string;
  system?: string;
  maxTokens?: number;
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
