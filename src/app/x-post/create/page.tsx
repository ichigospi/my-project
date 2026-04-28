"use client";

import XPostSkeleton from "@/components/XPostSkeleton";

export default function CreatePage() {
  return (
    <XPostSkeleton
      title="ポスト生成"
      emoji="✏️"
      description="ゼロから / テンプレから / デイリーから の3モードで生成"
      upcoming={[
        "生成モード選択（ゼロから / テンプレから / デイリーから）",
        "生成テーマ + 教育タイプ（12要素）+ ロジック型（課題解決/欲求喚起）",
        "ストーリー型運用要素・ジャブポスト要素のチェック",
        "参照する分析・参考ポスト・テンプレの選択",
        "モデル選択（Haiku / Sonnet / Opus）",
        "Claude プロンプトキャッシュで高速生成",
        "生成結果のコピー・保存・再生成・微調整",
        "生成履歴",
      ]}
    />
  );
}
