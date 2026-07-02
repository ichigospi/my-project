// AIモデル選択（Anthropic）。クライアント/サーバー共用。
// 「生成用」(台本・骨組み・修正) と「チェック用」(品質チェック) を別々に選べる。
// OpenAIキー使用時は従来通り gpt-4o 固定で、この設定は影響しない。

export const ALLOWED_AI_MODELS = ["claude-sonnet-4-6", "claude-opus-4-8", "claude-fable-5"] as const;
export type AiModelId = (typeof ALLOWED_AI_MODELS)[number];

export const DEFAULT_AI_MODEL: AiModelId = "claude-sonnet-4-6";

export const AI_MODEL_OPTIONS: { id: AiModelId; label: string; desc: string }[] = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6（$3/$15）", desc: "バランス型。チェック用はこれで十分" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8（$5/$25）", desc: "文章の質・指示追従が一段上。生成用のおすすめ" },
  { id: "claude-fable-5", label: "Claude Fable 5（$10/$50）", desc: "最高品質だが生成に時間がかかる（1リクエスト数分かかることも）。分割出力との併用推奨" },
];

export type AiModelPurpose = "generate" | "check";

const STORAGE_KEYS: Record<AiModelPurpose, string> = {
  generate: "ai_model_generate",
  check: "ai_model_check",
};

// サーバー側：リクエストのモデル指定を検証（不正・未指定はデフォルトに）
export function resolveAiModel(m?: string): AiModelId {
  return (ALLOWED_AI_MODELS as readonly string[]).includes(m || "") ? (m as AiModelId) : DEFAULT_AI_MODEL;
}

// クライアント側：保存されたモデル選択を取得/保存
export function getAiModel(purpose: AiModelPurpose): AiModelId {
  if (typeof window === "undefined") return DEFAULT_AI_MODEL;
  return resolveAiModel(localStorage.getItem(STORAGE_KEYS[purpose]) || "");
}

export function setAiModel(purpose: AiModelPurpose, model: AiModelId) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS[purpose], model);
}

// Anthropic APIリクエスト用ヘッダー。Fable 5 はserver-side fallbackのbetaヘッダーを付ける
export function anthropicHeaders(apiKey: string, model: AiModelId): Record<string, string> {
  const h: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  if (model === "claude-fable-5") h["anthropic-beta"] = "server-side-fallback-2026-06-01";
  return h;
}

// Anthropic APIリクエストbodyへの追加フィールド。
// Fable 5 は安全システムの誤検知(refusal)で生成が丸ごと失敗しないよう、Opus 4.8への自動フォールバックを指定する
export function anthropicExtraBody(model: AiModelId): Record<string, unknown> {
  return model === "claude-fable-5" ? { fallbacks: [{ model: "claude-opus-4-8" }] } : {};
}
