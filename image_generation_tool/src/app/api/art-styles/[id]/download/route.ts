// 絵柄の Lora ファイルを Civitai からローカルへダウンロードする。
//
// フロー:
//   1. art style から civitaiVersionId を取得
//   2. Civitai API でバージョン詳細→ primary file の downloadUrl を取得
//   3. 認証付き URL でストリーミング DL
//   4. storage/loras/<id>/<filename>.safetensors に保存
//   5. art style.loraUrl にファイル名をセット
//
// レスポンス: { ok, filename, sizeMB, podCommand }
//   - podCommand: ユーザーが RunPod Pod の Terminal に貼って同期するための wget 文字列

import { NextResponse } from "next/server";
import { createWriteStream } from "fs";
import { mkdir, stat } from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { prisma } from "@/lib/prisma";
import { fetchCivitaiVersion, withDownloadAuth } from "@/lib/civitai";

export const runtime = "nodejs";
export const maxDuration = 600;

function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const style = await prisma.artStyle.findUnique({ where: { id } });
  if (!style) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (style.source !== "civitai" || !style.civitaiVersionId) {
    return NextResponse.json(
      { error: "Civitai 取込形式の絵柄のみダウンロードできます" },
      { status: 400 },
    );
  }

  let version;
  try {
    version = await fetchCivitaiVersion(style.civitaiVersionId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
  if (!version) {
    return NextResponse.json({ error: "Civitai のバージョンが見つかりません" }, { status: 404 });
  }

  const primary = version.files.find((f) => f.primary) ?? version.files[0];
  if (!primary?.downloadUrl) {
    return NextResponse.json({ error: "DL URL が見つかりません" }, { status: 502 });
  }

  const filename = safeFilename(primary.name);
  const dir = path.join(process.cwd(), "storage", "loras", id);
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, filename);

  // 既に存在 + サイズ一致ならスキップ
  try {
    const st = await stat(dest);
    const expectedBytes = primary.sizeKB * 1024;
    if (Math.abs(st.size - expectedBytes) < 1024 * 100) {
      await prisma.artStyle.update({
        where: { id },
        data: { loraUrl: filename },
      });
      return NextResponse.json({
        ok: true,
        skipped: true,
        filename,
        sizeMB: Math.round(st.size / 1024 / 1024),
        podCommand: buildPodCommand(filename, primary.downloadUrl),
      });
    }
  } catch {
    /* ファイルなし → 普通にDL */
  }

  // ストリーミング DL（メモリ食わない）
  const url = withDownloadAuth(primary.downloadUrl);
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "image-gen-tool/1.0" },
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `DL 失敗: HTTP ${res.status} ${text.slice(0, 200)}` },
      { status: 502 },
    );
  }

  const out = createWriteStream(dest);
  // Web ReadableStream を Node Readable に変換して pipeline
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), out);

  const finalStat = await stat(dest);

  await prisma.artStyle.update({
    where: { id },
    data: { loraUrl: filename },
  });

  return NextResponse.json({
    ok: true,
    filename,
    sizeMB: Math.round(finalStat.size / 1024 / 1024),
    storedAt: `storage/loras/${id}/${filename}`,
    podCommand: buildPodCommand(filename, primary.downloadUrl),
  });
}

function buildPodCommand(filename: string, downloadUrl: string): string {
  // RunPod Pod の Terminal 直接 DL 用（API キーは環境変数に頼らずインライン）
  const key = process.env.CIVITAI_API_KEY;
  const url = key
    ? `${downloadUrl}${downloadUrl.includes("?") ? "&" : "?"}token=${key}`
    : downloadUrl;
  return `mkdir -p /workspace/models/loras && wget -O /workspace/models/loras/${filename} "${url}"`;
}
