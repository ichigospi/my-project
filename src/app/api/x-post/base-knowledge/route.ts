// x_post_system/ 配下のマークダウンナレッジを読み取り専用で公開
// AI生成時にプロンプトキャッシュへ注入される本体ファイルの内容を確認するためのAPI
import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";

const ROOT = path.join(process.cwd(), "x_post_system");

interface FileEntry {
  category: "common" | "business" | "spiritual" | "prompts";
  filename: string;
  relativePath: string;
  label: string;
}

const LABELS: Record<string, string> = {
  "knowledge_common/post_principles.md": "冒頭フックの14手法",
  "knowledge_common/structure_patterns.md": "構造パターン10タイプ",
  "knowledge_common/ng_patterns.md": "NGパターン",
  "knowledge_common/education_framework.md": "教育12要素",
  "knowledge_common/story_operation.md": "ストーリー型運用",
  "knowledge_common/incentive_design.md": "インセンティブ設計",
  "knowledge_business/account_info.md": "ビジ垢: 自アカ情報",
  "knowledge_business/teachings.md": "ビジ垢: 教材・指示書",
  "knowledge_business/reference_posts.md": "ビジ垢: 参考ポスト",
  "knowledge_business/post_angles_catalog.md": "ビジ垢: 切り口カタログ",
  "knowledge_spiritual/account_info.md": "占い垢: 自アカ情報",
  "knowledge_spiritual/teachings.md": "占い垢: 教材・指示書",
  "knowledge_spiritual/reference_posts.md": "占い垢: 参考ポスト",
  "prompts/analyze_trending.md": "プロンプト: 競合分析",
  "prompts/generate_post.md": "プロンプト: ポスト生成",
};

function categoryOf(rel: string): FileEntry["category"] {
  if (rel.startsWith("knowledge_common/")) return "common";
  if (rel.startsWith("knowledge_business/")) return "business";
  if (rel.startsWith("knowledge_spiritual/")) return "spiritual";
  return "prompts";
}

async function listMd(dir: string, prefix: string): Promise<string[]> {
  try {
    const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => `${prefix}${e.name}`);
  } catch {
    return [];
  }
}

// GET /api/x-post/base-knowledge          → ファイル一覧
// GET /api/x-post/base-knowledge?file=...  → そのファイルの中身
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get("file");

    if (file) {
      // パストラバーサル防止: 相対パス内 + .md限定 + 既知ディレクトリ配下のみ
      if (
        file.includes("..") ||
        !file.endsWith(".md") ||
        !(
          file.startsWith("knowledge_common/") ||
          file.startsWith("knowledge_business/") ||
          file.startsWith("knowledge_spiritual/") ||
          file.startsWith("prompts/")
        )
      ) {
        return NextResponse.json({ error: "不正なパス" }, { status: 400 });
      }
      const fullPath = path.join(ROOT, file);
      try {
        const content = await readFile(fullPath, "utf-8");
        return NextResponse.json({
          file,
          label: LABELS[file] ?? file,
          content,
          bytes: Buffer.byteLength(content, "utf-8"),
        });
      } catch {
        return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 404 });
      }
    }

    // 一覧取得
    const all = (
      await Promise.all([
        listMd("knowledge_common", "knowledge_common/"),
        listMd("knowledge_business", "knowledge_business/"),
        listMd("knowledge_spiritual", "knowledge_spiritual/"),
        listMd("prompts", "prompts/"),
      ])
    ).flat();

    const files: FileEntry[] = all.map((rel) => ({
      category: categoryOf(rel),
      filename: rel.split("/").pop() ?? rel,
      relativePath: rel,
      label: LABELS[rel] ?? rel,
    }));

    return NextResponse.json({ files });
  } catch (e) {
    console.error("GET /api/x-post/base-knowledge", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
