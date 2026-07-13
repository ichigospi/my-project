import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 新バージョン追加。旧バージョンの activeTo を自動で閉じる（変更前後比較の期間境界になる）
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { content, label, abGroup } = await req.json();

  const template = await prisma.template.findUnique({
    where: { id },
    include: { versions: { orderBy: { activeFrom: "desc" } } },
  });
  if (!template) {
    return NextResponse.json({ error: "テンプレが見つかりません" }, { status: 404 });
  }

  const now = new Date();
  // ABテスト用バージョン（abGroup指定）は並行運用なので旧版を閉じない
  if (!abGroup) {
    await prisma.templateVersion.updateMany({
      where: { templateId: id, activeTo: null },
      data: { activeTo: now },
    });
  }

  const version = await prisma.templateVersion.create({
    data: {
      templateId: id,
      label: label?.trim() || `v${template.versions.length + 1}`,
      content: content ?? "",
      abGroup: abGroup?.trim() || null,
      activeFrom: now,
    },
  });

  return NextResponse.json({ version });
}
