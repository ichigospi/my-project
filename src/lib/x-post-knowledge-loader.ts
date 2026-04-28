// x_post_system/ 配下の markdown ナレッジを読み込むサーバ専用ヘルパー
// プロンプトキャッシュで同じバイトを再利用するため、起動時にメモリにキャッシュして再利用する
import { readFile } from "fs/promises";
import path from "path";

const ROOT = path.join(process.cwd(), "x_post_system");

// 安全に読み込む（ファイルが無くてもエラーにしない）
async function safeRead(relativePath: string): Promise<string> {
  try {
    return await readFile(path.join(ROOT, relativePath), "utf-8");
  } catch {
    return "";
  }
}

// メモリキャッシュ（プロセス内）
let _cache: {
  framework: string;
  business: string;
  spiritual: string;
} | null = null;

export async function loadKnowledgeFramework(): Promise<string> {
  const cached = await getCache();
  return cached.framework;
}

export async function loadGenreKnowledge(genre: "business" | "spiritual"): Promise<string> {
  const cached = await getCache();
  return genre === "business" ? cached.business : cached.spiritual;
}

async function getCache() {
  if (_cache) return _cache;
  const [
    postPrinciples,
    structurePatterns,
    ngPatterns,
    educationFramework,
    storyOperation,
    incentiveDesign,
    businessAccount,
    businessTeachings,
    spiritualAccount,
    spiritualTeachings,
  ] = await Promise.all([
    safeRead("knowledge_common/post_principles.md"),
    safeRead("knowledge_common/structure_patterns.md"),
    safeRead("knowledge_common/ng_patterns.md"),
    safeRead("knowledge_common/education_framework.md"),
    safeRead("knowledge_common/story_operation.md"),
    safeRead("knowledge_common/incentive_design.md"),
    safeRead("knowledge_business/account_info.md"),
    safeRead("knowledge_business/teachings.md"),
    safeRead("knowledge_spiritual/account_info.md"),
    safeRead("knowledge_spiritual/teachings.md"),
  ]);

  const framework = [
    "==== Xポスト作成の原則 ====",
    postPrinciples,
    "==== 構成パターン（フック・強化要素・構造タイプ） ====",
    structurePatterns,
    "==== NGパターン ====",
    ngPatterns,
    "==== 12の教育要素 ====",
    educationFramework,
    "==== ストーリー型運用 ====",
    storyOperation,
    "==== インセンティブ設計 ====",
    incentiveDesign,
  ].filter(Boolean).join("\n\n");

  const business = [
    "==== ビジ垢の自アカ情報（参考） ====",
    businessAccount,
    "==== ビジ垢の教材・指示書 ====",
    businessTeachings,
  ].filter(Boolean).join("\n\n");

  const spiritual = [
    "==== 占い垢の自アカ情報（参考） ====",
    spiritualAccount,
    "==== 占い垢の教材・指示書 ====",
    spiritualTeachings,
  ].filter(Boolean).join("\n\n");

  _cache = { framework, business, spiritual };
  return _cache;
}

// 開発時にホットリロードしたい場合（必要に応じて呼ぶ）
export function clearKnowledgeCache() {
  _cache = null;
}
