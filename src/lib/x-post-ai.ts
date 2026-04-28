// Xポストツール用のAIヘルパー
// - Claude: 公式SDK + プロンプトキャッシュで大規模ナレッジコンテキストを効率注入
// - OpenAI: フォールバック（キャッシュ非対応）
//
// 既存の `ai-helper.ts` と分離する理由:
// - Xポストは数万トークンのナレッジを毎回注入するためキャッシュ必須
// - 既存ヘルパーは台本分析等の他機能と共用なのでX用の最適化を入れたくない

import Anthropic from "@anthropic-ai/sdk";

export type XPostModel =
  | "claude-haiku-4-5"
  | "claude-sonnet-4-6"
  | "claude-opus-4-7";

export const X_POST_MODEL_LABELS: Record<XPostModel, string> = {
  "claude-haiku-4-5": "Haiku 4.5（高速・安い）",
  "claude-sonnet-4-6": "Sonnet 4.6（バランス・推奨）",
  "claude-opus-4-7": "Opus 4.7（最高品質）",
};

export const DEFAULT_X_POST_MODEL: XPostModel = "claude-sonnet-4-6";

export interface XPostAIOptions {
  // ---- 安定コンテキスト（キャッシュされる）----
  // ベースのシステムプロンプト（ルール・人格・出力フォーマット等）
  systemPrompt: string;
  // ナレッジ本体（教材・自アカ情報・参考ポスト 等の大規模コンテキスト）
  knowledgeContext?: string;

  // ---- 可変部分（毎回変わる）----
  userInstruction: string;

  // ---- 設定 ----
  model?: XPostModel;
  maxTokens?: number;
  // 1時間キャッシュ（コスト2倍だが頻繁に同じプロンプトで生成する場合は得）
  // デフォルト false（5分キャッシュ）
  longCache?: boolean;
}

export interface XPostAIUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface XPostAIResponse {
  text: string;
  usage: XPostAIUsage;
  model: string;
  error?: string;
  retryable?: boolean;
}

export async function callXPostAI(
  apiKey: string,
  options: XPostAIOptions,
): Promise<XPostAIResponse> {
  if (!apiKey) {
    return emptyResponse({ error: "APIキーが未設定です" });
  }
  const isAnthropic = apiKey.startsWith("sk-ant-");
  if (isAnthropic) {
    return callAnthropic(apiKey, options);
  }
  return callOpenAI(apiKey, options);
}

// ============================================================
// Anthropic (公式SDK + プロンプトキャッシュ)
// ============================================================

async function callAnthropic(
  apiKey: string,
  options: XPostAIOptions,
): Promise<XPostAIResponse> {
  const client = new Anthropic({ apiKey });
  const model = options.model ?? DEFAULT_X_POST_MODEL;
  const maxTokens = options.maxTokens ?? 4096;
  const cacheControl: { type: "ephemeral"; ttl?: "1h" } = options.longCache
    ? { type: "ephemeral", ttl: "1h" }
    : { type: "ephemeral" };

  // システムプロンプトを2ブロック構造で組み立てる:
  // 1. ベースルール（軽量・常に同じ）
  // 2. ナレッジコンテキスト（重量・キャッシュ対象）
  //
  // cache_control は最後の system ブロックに付ける。
  // tools → system → messages の順でレンダリングされるので、
  // この位置に置けば system 全体がキャッシュされる。
  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: options.systemPrompt },
  ];
  if (options.knowledgeContext) {
    systemBlocks.push({
      type: "text",
      text: options.knowledgeContext,
      cache_control: cacheControl,
    });
  } else {
    // ナレッジが無い場合はベースのみキャッシュ
    systemBlocks[0].cache_control = cacheControl;
  }

  // 3回までリトライ（429/529のみ）
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemBlocks,
        messages: [{ role: "user", content: options.userInstruction }],
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
      if (e instanceof Anthropic.RateLimitError) {
        if (attempt === 2) {
          return emptyResponse({
            error: "レート制限",
            retryable: true,
            model,
          });
        }
        await sleep(5000 * (attempt + 1));
        continue;
      }
      if (
        e instanceof Anthropic.InternalServerError ||
        (e instanceof Anthropic.APIError && e.status === 529)
      ) {
        if (attempt === 2) {
          return emptyResponse({
            error: "サーバ過負荷",
            retryable: true,
            model,
          });
        }
        await sleep(5000 * (attempt + 1));
        continue;
      }
      const message = e instanceof Error ? e.message : String(e);
      return emptyResponse({ error: message, model });
    }
  }
  return emptyResponse({ error: "リトライ上限", retryable: true, model });
}

// ============================================================
// OpenAI フォールバック（キャッシュ非対応）
// ============================================================

async function callOpenAI(
  apiKey: string,
  options: XPostAIOptions,
): Promise<XPostAIResponse> {
  const maxTokens = options.maxTokens ?? 4096;
  const fullSystem = [options.systemPrompt, options.knowledgeContext]
    .filter(Boolean)
    .join("\n\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: fullSystem },
          { role: "user", content: options.userInstruction },
        ],
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return emptyResponse({
        error: e?.error?.message || "OpenAI API error",
        model: "gpt-4o",
      });
    }
    const data = await res.json();
    return {
      text: data?.choices?.[0]?.message?.content ?? "",
      model: data?.model ?? "gpt-4o",
      usage: {
        inputTokens: data?.usage?.prompt_tokens ?? 0,
        outputTokens: data?.usage?.completion_tokens ?? 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      },
    };
  } catch (e) {
    return emptyResponse({
      error: e instanceof Error ? e.message : String(e),
      model: "gpt-4o",
    });
  }
}

// ============================================================
// helpers
// ============================================================

function emptyResponse(opts: {
  error: string;
  retryable?: boolean;
  model?: string;
}): XPostAIResponse {
  return {
    text: "",
    model: opts.model ?? "",
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    },
    error: opts.error,
    retryable: opts.retryable,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
