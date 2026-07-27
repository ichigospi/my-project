// 動画編集用の一時素材ストア(サーバーサイド)
// Railway のコンテナFSはエフェメラルなため、生成素材・書き出し動画は tmpdir に置き、
// /api/video/assets/[id] で配信する。再デプロイで消える前提(必要なら再生成)。
import { mkdirSync, existsSync } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

const STORE_DIR = join(tmpdir(), "fortune-yt-video-assets");

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
