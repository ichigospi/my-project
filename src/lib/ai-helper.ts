// Claude/OpenAI API呼び出し共通ヘルパー（429/529リトライ付き）

export async function callAI(
  aiApiKey: string,
  prompt: string,
  options?: { maxTokens?: number; system?: string }
): Promise<{ text: string; error?: string; retryable?: boolean }> {
  const isAnthropic = aiApiKey.startsWith("sk-ant-");
  const maxTokens = options?.maxTokens || 4096;

  if (isAnthropic) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const body: Record<string, unknown> = {
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        };
        if (options?.system) body.system = options.system;

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": aiApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
        });

        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return { text: "", error: "Overloaded", retryable: true };
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }

        if (!res.ok) {
          const e = await res.json();
          return { text: "", error: e.error?.message || "API error" };
        }

        const data = await res.json();
        return { text: data.content?.[0]?.text || "" };
      } catch (e) {
        if (attempt === 2) return { text: "", error: String(e) };
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    return { text: "", error: "リトライ上限", retryable: true };
  } else {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            ...(options?.system ? [{ role: "system" as const, content: options.system }] : []),
            { role: "user" as const, content: prompt },
          ],
          max_tokens: maxTokens,
        }),
      });

      if (!res.ok) {
        const e = await res.json();
        return { text: "", error: e.error?.message || "API error" };
      }

      const data = await res.json();
      return { text: data.choices?.[0]?.message?.content || "" };
    } catch (e) {
      return { text: "", error: String(e) };
    }
  }
}
