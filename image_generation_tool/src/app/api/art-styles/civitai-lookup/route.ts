// Civitai モデル ID/URL から先頭バージョンのメタデータを返す（プレビュー用）。
// UI 側はこれを表示してから、ユーザーが「登録」を押すと /api/art-styles に POST する。

import { NextResponse } from "next/server";
import {
  fetchCivitaiModel,
  normalizeBaseModel,
  parseCivitaiModelInput,
} from "@/lib/civitai";

export const runtime = "nodejs";

interface Body {
  input?: string; // ID or URL
  versionId?: number; // 任意で特定バージョン指定
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const modelId = body.input ? parseCivitaiModelInput(body.input) : null;
  if (!modelId) {
    return NextResponse.json({ error: "Civitai のモデル ID または URL を入れてください" }, { status: 400 });
  }

  try {
    const model = await fetchCivitaiModel(modelId);
    if (!model) {
      return NextResponse.json({ error: "モデルが見つかりません" }, { status: 404 });
    }

    if (model.type !== "LORA" && model.type !== "Checkpoint") {
      return NextResponse.json(
        { error: `このタイプは未対応: ${model.type}（LORA か Checkpoint のみ）` },
        { status: 400 },
      );
    }

    const version =
      (body.versionId
        ? model.modelVersions.find((v) => v.id === body.versionId)
        : null) ?? model.modelVersions[0];

    if (!version) {
      return NextResponse.json({ error: "バージョン情報がありません" }, { status: 404 });
    }

    const primaryFile =
      version.files.find((f) => f.primary) ?? version.files[0] ?? null;

    return NextResponse.json({
      model: {
        id: model.id,
        name: model.name,
        type: model.type,
        nsfw: model.nsfw,
      },
      version: {
        id: version.id,
        name: version.name,
        baseModel: version.baseModel,
        normalizedBaseModel: normalizeBaseModel(version.baseModel),
        trainedWords: version.trainedWords ?? [],
        thumbnails: version.images.slice(0, 6).map((i) => i.url),
        primaryFile: primaryFile
          ? {
              name: primaryFile.name,
              sizeMB: Math.round(primaryFile.sizeKB / 1024),
              downloadUrl: primaryFile.downloadUrl,
            }
          : null,
      },
      versionsAvailable: model.modelVersions.map((v) => ({
        id: v.id,
        name: v.name,
        baseModel: v.baseModel,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
