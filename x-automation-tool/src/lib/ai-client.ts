// AI API呼び出しヘルパー（Claude / OpenAI デュアル対応）

export async function callAI(
  aiApiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048
): Promise<{ text: string; error?: string }> {
  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  try {
    if (isAnthropic) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": aiApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        return { text: "", error: error.error?.message || `Claude APIエラー (${res.status})` };
      }

      const data = await res.json();
      return { text: data.content?.[0]?.text || "" };
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        return { text: "", error: error.error?.message || `OpenAI APIエラー (${res.status})` };
      }

      const data = await res.json();
      return { text: data.choices?.[0]?.message?.content || "" };
    }
  } catch (err) {
    return { text: "", error: err instanceof Error ? err.message : "AI API呼び出しに失敗しました" };
  }
}
