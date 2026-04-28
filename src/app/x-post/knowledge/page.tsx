"use client";

import XPostSkeleton from "@/components/XPostSkeleton";

export default function KnowledgePage() {
  return (
    <XPostSkeleton
      title="ナレッジ管理"
      emoji="📚"
      description="自アカ情報・教材・参考ポスト・メモを統一管理"
      upcoming={[
        "自アカ情報フォーム（過去のストーリー構造化フィールド含む）",
        "教材登録・編集（既存 x_post_system/ MDからのインポート）",
        "参考ポスト登録（フォルダ分け対応）",
        "メモ機能",
        "フォルダの作成・編集・色分け",
      ]}
    />
  );
}
