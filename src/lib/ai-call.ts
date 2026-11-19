// サーバー側のAI呼び出し（Anthropic / OpenAI）の共通部品。生成・整合編集・修正で同じ呼び方にする
import { resolveAiModel, anthropicHeaders, anthropicExtraBody, type AiModelId } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

export interface AiCallResult { text: string; error?: string; retryable?: boolean; status?: number }

export async function callAi(aiApiKey: string, aiModel: AiModelId | string | undefined, prompt: string, opts?: { maxTokens?: number; system?: string }): Promise<AiCallResult> {
  const model = resolveAiModel(typeof aiModel === "string" ? aiModel : undefined);
  const maxTokens = opts?.maxTokens ?? 16000;
  const isAnthropic = aiApiKey.startsWith("sk-ant-");
  if (isAnthropic) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders(aiApiKey, model),
        body: JSON.stringify({ model, max_tokens: maxTokens, ...(opts?.system ? { system: opts.system } : {}), messages: [{ role: "user", content: prompt }], ...anthropicExtraBody(model) }),
      });
      if (res.status === 429 || res.status === 529) {
        if (attempt === 2) return { text: "", retryable: true, error: "AIが混雑しています。少し時間をおいて再実行してください", status: res.status };
        await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) { const e = await res.json().catch(() => ({})); return { text: "", error: e?.error?.message || `API error (${res.status})`, status: res.status }; }
      const data = await res.json();
      recordUsage({ model: data.model || model, usage: data.usage });
      return { text: ((data.content || []) as { type?: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text || "").join("") };
    }
    return { text: "", error: "リトライ上限" };
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
    body: JSON.stringify({ model: "gpt-4o", messages: [...(opts?.system ? [{ role: "system", content: opts.system }] : []), { role: "user", content: prompt }], max_tokens: maxTokens }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); return { text: "", error: e?.error?.message || `API error (${res.status})`, status: res.status }; }
  const data = await res.json();
  recordUsage({ model: "gpt-4o", usage: data.usage });
  return { text: data.choices?.[0]?.message?.content || "" };
}
