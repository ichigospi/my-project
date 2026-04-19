// 絵柄（ArtStyle）の一覧取得 + 新規作成。
//
// 4 形式（source）に対応:
//   - tag_only:  styleTags のみ。Lora 不要、即使える。
//   - civitai:   Civitai 由来。styleTags + triggerWords + civitai メタを保持。
//                ※Lora ファイル本体の RunPod Volume 同期は今は手動。
//   - uploaded:  自前 .safetensors。今はローカル保存のみ（要手動同期）。
//   - trained:   自分で学習。Phase 2 で実装。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ALLOWED_SOURCES = new Set(["tag_only", "civitai", "uploaded", "trained"]);
const ALLOWED_BASE_MODELS = new Set(["illustrious", "pony", "sdxl"]);

interface CreateBody {
  name?: string;
  source?: string;
  baseModel?: string;
  loraUrl?: string | null;
  loraScale?: number;
  triggerWords?: string | null;
  styleTags?: string | null;
  civitaiModelId?: number | null;
  civitaiVersionId?: number | null;
  thumbnailsJson?: string | null;
  memo?: string | null;
  tagsJson?: string | null;
}

export async function GET() {
  const items = await prisma.artStyle.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const source = body.source ?? "tag_only";
  if (!ALLOWED_SOURCES.has(source))
    return NextResponse.json({ error: `invalid source: ${source}` }, { status: 400 });

  const baseModel = (body.baseModel ?? "illustrious").toLowerCase();
  if (!ALLOWED_BASE_MODELS.has(baseModel))
    return NextResponse.json({ error: `invalid baseModel: ${baseModel}` }, { status: 400 });

  // tag_only は styleTags が無いと意味がない
  if (source === "tag_only" && !body.styleTags?.trim()) {
    return NextResponse.json(
      { error: "tag_only には styleTags が必要です" },
      { status: 400 },
    );
  }

  const created = await prisma.artStyle.create({
    data: {
      name,
      source,
      baseModel,
      loraUrl: body.loraUrl?.trim() || null,
      loraScale: typeof body.loraScale === "number" ? body.loraScale : 0.8,
      triggerWords: body.triggerWords?.trim() || null,
      styleTags: body.styleTags?.trim() || null,
      civitaiModelId: body.civitaiModelId ?? null,
      civitaiVersionId: body.civitaiVersionId ?? null,
      thumbnailsJson: body.thumbnailsJson ?? null,
      memo: body.memo?.trim() || null,
      tagsJson: body.tagsJson ?? null,
    },
  });

  return NextResponse.json({ item: created }, { status: 201 });
}
