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
export const GEMINI_MODEL_SUGGESTIONS = ["gemini-4.0-neon", "gemini-3-pro", "gemini-2.5-pro", "gemini-2.5-flash"];
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

// Gemini を使うときに生成・修正プロンプトの先頭へ足す前置き（Geminiの癖＝相手に合わせすぎる・冗長・JSON外の前置きを書く、を先に封じる）
export function geminiPreamble(kind: "generate" | "revise" | "edit"): string {
  const common = `【この指示の読み方（必ず守る）】
- 以下の指示は優先順位つきの仕様書です。矛盾したら「禁止事項 → 枚数・カード・世界観 → 骨組み → 規範 → 文体」の順に優先します
- 丁寧な前置き・謝辞・要約・補足説明・注意書きは一切書きません。求められた成果物だけを出します
- 「〜してもよい」は許可であって要求ではありません。入れる理由が無ければ入れません
- 例文や説明に書かれた文を写しません。狙いだけを取り、この台本の言葉で書きます
- 日本語は話し言葉。「〜ではありません」より「〜じゃないんです」、「〜ということです」より「〜ってことです」。砕けすぎない`;
  if (kind === "generate") return `${common}
- 文字数は指示の範囲を守ります。上限を超えそうなら、説明の繰り返しと比喩を削って収めます（内容を増やして超えない）
- 出力は台本本文だけ。見出し・箇条書き・メタ的な注記・最後のまとめ文は書きません`;
  if (kind === "revise") return `${common}
- 指示された指摘に該当する段落だけを直します。該当しない段落は返しません。「ついでに」の修正はしません
- 直す段落は、指摘の箇所だけでなく段落全体を自然な一続きの語りとして書き直します。文を継ぎ足して2文並べる形にはしません
- 「該当:」の引用文がもう本文に無い指摘は、すでに直っているので無視します。別の段落を無理に直しません
- 出力はJSONだけ。JSONの前後に文章を付けません。段落番号は本文の番号をそのまま使います`;
  return `${common}
- 直してよい種類（重複・矛盾・場所違い・AIっぽさ・世界観）以外は触りません。問題の無い段落は返しません
- 字数は元の段落の±20%。全体を減らしません
- 出力はJSONだけ。JSONの前後に文章を付けません`;
}
