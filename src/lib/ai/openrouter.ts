export async function callOpenRouter(
  prompt: string,
  options?: { model?: string; system?: string }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY 환경변수가 없습니다");
  }

  const model = options?.model || "deepseek/deepseek-v4-flash";
  const messages: { role: string; content: string }[] = [];

  if (options?.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: prompt });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    });

    if (!response.ok) {
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = "Unable to parse error body";
      }
      throw new Error(`OpenRouter API error (Status ${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error("올바르지 않은 OpenRouter 응답 형식입니다.");
    }

    return data.choices[0].message.content;
  } catch (error: any) {
    throw new Error(`OpenRouter 호출 실패: ${error.message}`);
  }
}
