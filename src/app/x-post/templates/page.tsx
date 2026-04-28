"use client";

import XPostSkeleton from "@/components/XPostSkeleton";

export default function TemplatesPage() {
  return (
    <XPostSkeleton
      title="テンプレ + シーケンスパターン"
      emoji="📋"
      description="単一ポストテンプレ + 連投/引用RTを含むシーケンスパターンを管理"
      upcoming={[
        "単一ポストテンプレ作成（構造ラベル + スケルトン穴埋め）",
        "シーケンスパターン作成（複数スロット + 接続タイプ）",
        "競合ポスト/参考ポストからテンプレ化（手動）",
        "AI支援によるスケルトン化提案（Phase 4以降）",
        "競合ポストから自動パターン化（Phase 8）",
        "フォルダ分け対応",
        "「ライフスタイル爆発→マネタイズ流れ展開」など初期パターン登録",
      ]}
    />
  );
}
