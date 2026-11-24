// AIモデル選択。クライアント/サーバー共用。
// 「生成用」(台本・骨組み・修正) と「チェック用」(品質チェック) を別々に選べる。
// 保存値は Claude のモデルID、または "gemini:<モデルID>"（Geminiを使う。キーは設定の Gemini APIキー）。
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

// ===== プロバイダ指定 =====
export type AiProvider = "anthropic" | "gemini";
export const GEMINI_PREFIX = "gemini:";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-pro";
export const GEMINI_MODEL_SUGGESTIONS = ["gemini-2.5-pro", "gemini-2.5-flash"];
export function parseAiSpec(raw?: string): { provider: AiProvider; model: string } {
  const s = (raw || "").trim();
  if (s.startsWith(GEMINI_PREFIX)) return { provider: "gemini", model: s.slice(GEMINI_PREFIX.length).trim() || DEFAULT_GEMINI_MODEL };
  return { provider: "anthropic", model: resolveAiModel(s) };
}
// サーバー側: リクエストのモデル指定を「そのまま渡せる文字列」に正規化（Claudeは検証済みID、Geminiは "gemini:..." のまま）
export function normalizeAiModel(raw?: string): string {
  const spec = parseAiSpec(raw);
  return spec.provider === "gemini" ? `${GEMINI_PREFIX}${spec.model}` : spec.model;
}

const STORAGE_KEYS: Record<AiModelPurpose, string> = {
  generate: "ai_model_generate",
  check: "ai_model_check",
};

// サーバー側：リクエストのモデル指定を検証（不正・未指定はデフォルトに）
export function resolveAiModel(m?: string): AiModelId {
  return (ALLOWED_AI_MODELS as readonly string[]).includes(m || "") ? (m as AiModelId) : DEFAULT_AI_MODEL;
}

// クライアント側：保存されたモデル選択を取得/保存
export function getAiModel(purpose: AiModelPurpose): string {
  if (typeof window === "undefined") return DEFAULT_AI_MODEL;
  return normalizeAiModel(localStorage.getItem(STORAGE_KEYS[purpose]) || "");
}

export function setAiModel(purpose: AiModelPurpose, model: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS[purpose], normalizeAiModel(model));
}

// 共有同期用: 保存されている生の値（未設定なら空文字）。
// デフォルト値でサーバーの共有設定を潰さないよう、未設定は未設定のまま返す
export function getStoredAiModel(purpose: AiModelPurpose): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEYS[purpose]) || "";
}

// 共有同期用: サーバーから受け取った値をローカルに反映（不正値は無視）
export function applyAiModelFromServer(purpose: AiModelPurpose, model: string) {
  if (typeof window === "undefined") return;
  if (!(ALLOWED_AI_MODELS as readonly string[]).includes(model) && !model.startsWith(GEMINI_PREFIX)) return;
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
