// Threadsツール用のAIヘルパー（Xツールとは独立）
// Anthropic公式SDK + プロンプトキャッシュ。アカウント情報+ノウハウを毎回注入するためキャッシュ必須。

import Anthropic from "@anthropic-ai/sdk";

export type ThreadsAiModel =
  | "claude-haiku-4-5"
  | "claude-sonnet-4-6"
  | "claude-opus-4-8";

export const THREADS_AI_MODELS: { id: ThreadsAiModel; label: string }[] = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5（高速・安い）" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6（バランス・推奨）" },
  { id: "claude-opus-4-8", label: "Opus 4.8（最高品質）" },
];

export const DEFAULT_THREADS_AI_MODEL: ThreadsAiModel = "claude-sonnet-4-6";

export function resolveThreadsAiModel(m?: string): ThreadsAiModel {
  return THREADS_AI_MODELS.some((x) => x.id === m)
    ? (m as ThreadsAiModel)
    : DEFAULT_THREADS_AI_MODEL;
}

export interface ThreadsAiOptions {
  // 安定コンテキスト（キャッシュされる）
  systemPrompt: string;
  knowledgeContext?: string;
  // 可変部分
  userInstruction?: string;
  // マルチターン（壁打ちチャット用）。指定時は userInstruction より優先
  messages?: { role: "user" | "assistant"; content: string }[];
  model?: ThreadsAiModel;
  maxTokens?: number;
}

export interface ThreadsAiResponse {
  text: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
  error?: string;
  retryable?: boolean;
}

function emptyResponse(partial: Partial<ThreadsAiResponse>): ThreadsAiResponse {
  return {
    text: "",
    model: "",
    usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
    ...partial,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callThreadsAI(
  apiKey: string,
  options: ThreadsAiOptions,
): Promise<ThreadsAiResponse> {
  if (!apiKey) {
    return emptyResponse({ error: "APIキーが未設定です" });
  }

  const client = new Anthropic({ apiKey });
  const model = options.model ?? DEFAULT_THREADS_AI_MODEL;
  const maxTokens = options.maxTokens ?? 4096;

  // system を2ブロックにして重いナレッジ側にキャッシュを付ける
  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: options.systemPrompt },
  ];
  if (options.knowledgeContext) {
    systemBlocks.push({
      type: "text",
      text: options.knowledgeContext,
      cache_control: { type: "ephemeral" },
    });
  } else {
    systemBlocks[0].cache_control = { type: "ephemeral" };
  }

  const messages: Anthropic.MessageParam[] =
    options.messages && options.messages.length > 0
      ? options.messages
      : [{ role: "user", content: options.userInstruction ?? "" }];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemBlocks,
        messages,
      });
      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      return {
        text: textBlock?.text ?? "",
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens ?? 0,
          outputTokens: response.usage.output_tokens ?? 0,
          cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
          cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        },
      };
    } catch (e) {
      const isOverloaded =
        e instanceof Anthropic.RateLimitError ||
        (e instanceof Anthropic.APIError && e.status === 529);
      if (isOverloaded && attempt < 2) {
        await sleep(5000 * (attempt + 1));
        continue;
      }
      if (isOverloaded) {
        return emptyResponse({ error: "混雑中です。少し待って再実行してください", retryable: true, model });
      }
      const msg = e instanceof Error ? e.message : String(e);
      return emptyResponse({ error: msg, model });
    }
  }
  return emptyResponse({ error: "AI呼び出しに失敗しました", model });
}

// AIの返答からJSONを取り出す（コードフェンス・前後の説明文に耐える）
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    // 最初の { か [ から最後の } か ] までを試す
    const start = c.search(/[[{]/);
    if (start === -1) continue;
    const end = Math.max(c.lastIndexOf("}"), c.lastIndexOf("]"));
    if (end <= start) continue;
    try {
      return JSON.parse(c.substring(start, end + 1)) as T;
    } catch {
      continue;
    }
  }
  return null;
}
