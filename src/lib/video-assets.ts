// 動画編集用の素材ストア(サーバーサイド)
// 保存先は環境変数 VIDEO_ASSET_DIR(Railwayの永続ボリュームのマウント先を指定)。
// 未設定なら tmpdir(再デプロイで消える)。/api/video/assets/[id] で配信する。
import { mkdirSync, existsSync } from "fs";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

const STORE_DIR = process.env.VIDEO_ASSET_DIR || join(tmpdir(), "fortune-yt-video-assets");

export const ALLOWED_EXTS = ["png", "jpg", "jpeg", "webp", "mp4", "mov", "webm", "mp3", "wav", "m4a"] as const;
const ASSET_ID_RE = /^[a-z0-9]+\.[a-z0-9]+$/;

export function assetStoreDir(): string {
  if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
  return STORE_DIR;
}

/** バッファを保存して素材ID(= ファイル名)を返す */
export async function saveAsset(buf: Buffer, ext: string): Promise<string> {
  const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!(ALLOWED_EXTS as readonly string[]).includes(cleanExt)) {
    throw new Error(`許可されていない拡張子です: ${ext}`);
  }
  const id = `${Date.now().toString(36)}${randomBytes(6).toString("hex")}.${cleanExt}`;
  await writeFile(join(assetStoreDir(), id), buf);
  return id;
}

/** 素材IDをフルパスに解決する(不正なIDは null) */
export function assetPath(id: string): string | null {
  if (!ASSET_ID_RE.test(id)) return null;
  const ext = id.split(".").pop() || "";
  if (!(ALLOWED_EXTS as readonly string[]).includes(ext)) return null;
  return join(assetStoreDir(), id);
}

export function assetUrl(id: string): string {
  return `/api/video/assets/${id}`;
}

/** 外部URL(生成AIのCDN等)から素材を取り込む */
export async function importAssetFromUrl(url: string, fallbackExt: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`素材のダウンロードに失敗しました (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return "";
    }
  })();
  const extMatch = pathname.match(/\.([a-z0-9]{2,4})$/i);
  const ext = extMatch ? extMatch[1] : fallbackExt;
  return saveAsset(buf, ext);
}

// ---- 素材ライブラリ(生成済みAI素材の使い回し用インデックス) ----
// 素材ファイルと同じディレクトリの library.json に保存する。
// VIDEO_ASSET_DIR を永続ボリュームにすれば再デプロイ後も使い回せる。

export interface LibraryEntry {
  id: string; // 素材ID(ファイル名)
  kind: "image" | "video" | "audio";
  source: string; // openai_image | sora_video | litvideo_video | upload | render
  prompt?: string;
  label?: string;
  createdAt: string;
}

const LIBRARY_INDEX = "library.json";

async function readLibrary(): Promise<LibraryEntry[]> {
  try {
    const raw = await readFile(join(assetStoreDir(), LIBRARY_INDEX), "utf-8");
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeLibrary(list: LibraryEntry[]): Promise<void> {
  await writeFile(join(assetStoreDir(), LIBRARY_INDEX), JSON.stringify(list), "utf-8");
}

export function kindForExt(ext: string): "image" | "video" | "audio" {
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "image";
  if (["mp3", "wav", "m4a"].includes(ext)) return "audio";
  return "video";
}

export async function addToLibrary(entry: Omit<LibraryEntry, "createdAt">): Promise<void> {
  try {
    const list = await readLibrary();
    if (!list.some((e) => e.id === entry.id)) {
      list.unshift({ ...entry, createdAt: new Date().toISOString() });
      await writeLibrary(list.slice(0, 500));
    }
  } catch (e) {
    // ライブラリ登録の失敗は素材生成自体を失敗させない
    console.error("addToLibrary failed", e);
  }
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  const list = await readLibrary();
  // ファイルが消えているエントリ(再デプロイ等)は除外して返す
  return list.filter((e) => {
    const p = assetPath(e.id);
    return p && existsSync(p);
  });
}

export async function removeFromLibrary(id: string): Promise<void> {
  const list = await readLibrary();
  await writeLibrary(list.filter((e) => e.id !== id));
  const p = assetPath(id);
  if (p && existsSync(p)) await unlink(p).catch(() => {});
}

export const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
};
