// サーバー側のAI呼び出しの共通部品。生成・整合編集・修正・チェックで同じ呼び方にする。
// プロバイダ: Anthropic（既定）／Gemini（モデル指定が "gemini:<model>" のとき。キーは共有設定の Gemini APIキー）／OpenAI（キーが sk-ant- で始まらないとき）
import { resolveAiModel, anthropicHeaders, anthropicExtraBody, parseAiSpec } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

export interface AiCallResult { text: string; error?: string; retryable?: boolean; status?: number }
export interface AiMessage { role: "user" | "assistant"; content: string }
export interface AiCallOptions {
  maxTokens?: number;
  system?: string;
  jsonMode?: boolean;      // JSONだけを返させたいとき（OpenAI/Gemini は応答形式で強制。Anthropic は指示文に任せる）
  messages?: AiMessage[];  // 複数ターン（壁打ち）。指定時は prompt を無視する
  geminiKey?: string;      // 未指定なら共有設定から読む
}

async function loadGeminiKey(): Promise<string> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.appSetting.findUnique({ where: { key: "shared_gemini_api_key" } });
    return row?.value || "";
  } catch { return ""; }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Gemini は「考える」ぶんのトークン（thinking）も maxOutputTokens に含めて数える。
// Claude 向けの小さめの上限（2,500〜16,000）をそのまま渡すと、考えている途中で上限に当たり、本文が空のまま MAX_TOKENS で止まる。
// そのため上限は本文ぶん＋考えるぶんで広く取る（モデルの上限 65,536 まで）。実際に使った分しか課金されない
const GEMINI_MAX_OUTPUT = 65536;
const geminiBudget = (maxTokens?: number) => Math.min(GEMINI_MAX_OUTPUT, Math.max((maxTokens ?? 16000) + 24000, 32768));

async function callGemini(apiKey: string, model: string, prompt: string, opts: AiCallOptions, budget?: number): Promise<AiCallResult> {
  const contents = (opts.messages && opts.messages.length > 0 ? opts.messages : [{ role: "user" as const, content: prompt }])
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const maxOutputTokens = budget ?? geminiBudget(opts.maxTokens);
  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens, ...(opts.jsonMode ? { responseMimeType: "application/json" } : {}) },
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status === 503) {
      if (attempt === 2) return { text: "", retryable: true, error: "Geminiが混雑しています。少し時間をおいて再実行してください", status: res.status };
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { text: "", error: e?.error?.message || `Gemini API error (${res.status})`, status: res.status };
    }
    const data = await res.json();
    const cand = (data.candidates || [])[0];
    const text = ((cand?.content?.parts || []) as { text?: string }[]).map((p) => p.text || "").join("");
    const u = data.usageMetadata || {};
    recordUsage({ model: `gemini/${model}`, usage: { input_tokens: u.promptTokenCount || 0, output_tokens: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) } });
    if (cand?.finishReason === "MAX_TOKENS") {
      // 上限に当たった。まだ広げられるなら一度だけ上限いっぱいで引き直す（本文が途中で切れたものを返さない）
      if (maxOutputTokens < GEMINI_MAX_OUTPUT) return callGemini(apiKey, model, prompt, opts, GEMINI_MAX_OUTPUT);
      if (!text) return { text: "", error: `Geminiが考えるぶんで出力の上限（${GEMINI_MAX_OUTPUT.toLocaleString()}トークン）を使い切り、本文を返せませんでした。もう一度実行するか、設定でGeminiのモデルを変えてください（思考が長いモデルで起きやすい）` };
      return { text, error: "Geminiの出力が上限で途中で切れました。もう一度実行してください" };
    }
    if (!text && cand?.finishReason && cand.finishReason !== "STOP") return { text: "", error: `Geminiが応答を止めました（${cand.finishReason}）` };
    return { text };
  }
  return { text: "", error: "リトライ上限" };
}

export async function callAi(aiApiKey: string, aiModel: string | undefined, prompt: string, opts?: AiCallOptions): Promise<AiCallResult> {
  const o = opts || {};
  const spec = parseAiSpec(aiModel);
  if (spec.provider === "gemini") {
    const key = o.geminiKey || (await loadGeminiKey());
    if (!key) return { text: "", error: "Gemini APIキーが未設定です（設定ページで保存してください）", status: 400 };
    return callGemini(key, spec.model, prompt, o);
  }
  const maxTokens = o.maxTokens ?? 16000;
  const isAnthropic = aiApiKey.startsWith("sk-ant-");
  const messages = o.messages && o.messages.length > 0 ? o.messages : [{ role: "user" as const, content: prompt }];
  if (isAnthropic) {
    const model = resolveAiModel(spec.model);
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders(aiApiKey, model),
        body: JSON.stringify({ model, max_tokens: maxTokens, ...(o.system ? { system: o.system } : {}), messages, ...anthropicExtraBody(model) }),
      });
      if (res.status === 429 || res.status === 529) {
        if (attempt === 2) return { text: "", retryable: true, error: "AIが混雑しています。少し時間をおいて再実行してください", status: res.status };
        await sleep(5000 * (attempt + 1));
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
    body: JSON.stringify({ model: "gpt-4o", messages: [...(o.system ? [{ role: "system", content: o.system }] : []), ...messages], max_tokens: maxTokens, ...(o.jsonMode ? { response_format: { type: "json_object" } } : {}) }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); return { text: "", error: e?.error?.message || `API error (${res.status})`, status: res.status }; }
  const data = await res.json();
  recordUsage({ model: "gpt-4o", usage: data.usage });
  return { text: data.choices?.[0]?.message?.content || "" };
}
