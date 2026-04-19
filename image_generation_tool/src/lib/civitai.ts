// Civitai API ラッパ。
// - models endpoint からモデル情報を取得
// - 認証は CIVITAI_API_KEY（Bearer）
// - 我々の用途はメタデータ取得＋将来の DL URL 取得

const CIVITAI_API_BASE = "https://civitai.com/api/v1";

export interface CivitaiFile {
  id: number;
  name: string;
  sizeKB: number;
  type: string;
  downloadUrl: string;
  primary?: boolean;
}

export interface CivitaiImage {
  url: string;
  nsfw?: boolean | string;
  width?: number;
  height?: number;
}

export interface CivitaiModelVersion {
  id: number;
  name: string;
  baseModel: string | null; // "Illustrious", "Pony", "SDXL 1.0" 等
  trainedWords: string[] | null;
  files: CivitaiFile[];
  images: CivitaiImage[];
}

export interface CivitaiModel {
  id: number;
  name: string;
  type: string; // "LORA" / "Checkpoint" / "TextualInversion" 等
  description?: string | null;
  nsfw: boolean;
  modelVersions: CivitaiModelVersion[];
}

function authHeader(): Record<string, string> {
  const key = process.env.CIVITAI_API_KEY;
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

/** モデル情報を取得。404 等は null を返す。 */
export async function fetchCivitaiModel(modelId: number): Promise<CivitaiModel | null> {
  const res = await fetch(`${CIVITAI_API_BASE}/models/${modelId}`, {
    headers: { Accept: "application/json", ...authHeader() },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Civitai API ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as CivitaiModel;
}

/** Civitai の URL or 数値ID から model id を抽出。 */
export function parseCivitaiModelInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // 数値そのもの
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  // URL からモデル ID を取り出す: https://civitai.com/models/12345/...
  const m = trimmed.match(/civitai\.com\/models\/(\d+)/i);
  if (m) return Number(m[1]);
  return null;
}

/** Civitai の baseModel 表記をうちの "illustrious"/"pony"/"sdxl" に正規化。 */
export function normalizeBaseModel(bm: string | null | undefined): string {
  if (!bm) return "sdxl";
  const lower = bm.toLowerCase();
  if (lower.includes("illustrious") || lower.includes("noob")) return "illustrious";
  if (lower.includes("pony")) return "pony";
  if (lower.includes("sdxl")) return "sdxl";
  return "sdxl";
}

/** バージョンID から直接バージョン情報を取得。 */
export async function fetchCivitaiVersion(
  versionId: number,
): Promise<CivitaiModelVersion | null> {
  const res = await fetch(`${CIVITAI_API_BASE}/model-versions/${versionId}`, {
    headers: { Accept: "application/json", ...authHeader() },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Civitai API ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as CivitaiModelVersion;
}

/** API key 付きの DL URL（NSFW モデルでも認可が通る形）。 */
export function withDownloadAuth(url: string): string {
  const key = process.env.CIVITAI_API_KEY;
  if (!key) return url;
  // ?token= or &token= で API キーを付与
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${encodeURIComponent(key)}`;
}
