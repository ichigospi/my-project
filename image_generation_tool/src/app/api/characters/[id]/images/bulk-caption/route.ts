// 複数の参照画像に一括でキャプションを適用する。
// selection:
//   "all"          全画像
//   "uncaptioned"  キャプション未設定のみ
//   string[]       imageIds 配列
// mode:
//   "replace"     既存を置換
//   "prepend"     先頭に追加（既存の前に挿入）
//   "append"      末尾に追加
//   "only-empty"  既存が空のときだけ書き込む

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Selection = "all" | "uncaptioned" | string[];
type Mode = "replace" | "prepend" | "append" | "only-empty";

interface Body {
  selection?: Selection;
  caption?: string;
  mode?: Mode;
}

function mergeCaption(existing: string | null, incoming: string, mode: Mode): string | null {
  const ex = existing?.trim() ?? "";
  const inc = incoming.trim();
  if (!inc) return existing;

  switch (mode) {
    case "replace":
      return inc;
    case "prepend":
      return ex ? `${inc}, ${ex}` : inc;
    case "append":
      return ex ? `${ex}, ${inc}` : inc;
    case "only-empty":
      return ex ? existing : inc;
    default:
      return inc;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const caption = (body.caption ?? "").toString();
  const mode: Mode = body.mode ?? "only-empty";
  const selection: Selection = body.selection ?? "uncaptioned";

  const all = await prisma.referenceImage.findMany({
    where: { characterId: id },
    orderBy: { createdAt: "asc" },
  });

  let targets = all;
  if (selection === "uncaptioned") {
    targets = all.filter((i) => !i.caption?.trim());
  } else if (Array.isArray(selection)) {
    const idset = new Set(selection);
    targets = all.filter((i) => idset.has(i.id));
  }

  let updated = 0;
  for (const img of targets) {
    const next = mergeCaption(img.caption, caption, mode);
    if (next !== img.caption) {
      await prisma.referenceImage.update({
        where: { id: img.id },
        data: {
          caption: next?.trim() || null,
          captionSource: "manual",
        },
      });
      updated += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    targeted: targets.length,
    updated,
  });
}
