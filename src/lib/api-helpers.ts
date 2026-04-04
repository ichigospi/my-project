export function getAiApiKey(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("ai_api_key") || "";
  }
  return "";
}

export function setStoredKey(key: string, value: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, value);
  }
}

export function getStoredKey(key: string): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem(key) || "";
  }
  return "";
}

export async function callAI(prompt: string, apiKey: string, options?: {
  systemPrompt?: string;
  maxTokens?: number;
  images?: { type: "base64"; media_type: string; data: string }[];
}): Promise<string> {
  if (!apiKey) throw new Error("AI APIキーが設定されていません");

  const isClaude = apiKey.startsWith("sk-ant-");

  if (isClaude) {
    const content: unknown[] = [];
    if (options?.images) {
      for (const img of options.images) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: img.media_type, data: img.data },
        });
      }
    }
    content.push({ type: "text", text: prompt });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: options?.maxTokens || 4096,
        system: options?.systemPrompt || "",
        messages: [{ role: "user", content }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "AI API error");
    return data.content?.[0]?.text || "";
  } else {
    const messages: unknown[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: options?.maxTokens || 4096,
        messages,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "AI API error");
    return data.choices?.[0]?.message?.content || "";
  }
}
