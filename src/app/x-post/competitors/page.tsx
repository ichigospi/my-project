"use client";

import XPostSkeleton from "@/components/XPostSkeleton";

export default function CompetitorsPage() {
  return (
    <XPostSkeleton
      title="競合管理 + ポスト収集"
      emoji="👥"
      description="競合アカウント登録 + 伸びてるポストを手動ペースト or X APIで収集"
      upcoming={[
        "競合アカウント登録（@ハンドル / 名前 / メモ）",
        "ポスト収集モーダル（手動ペースト: URL/本文/指標を入力）",
        "X API v2 自動収集モード（Bearer Token 設定後）",
        "収集済みポスト一覧（フィルタ: 競合別 / 期間 / いいね順）",
        "ポストにフォルダを付与",
        "選択したポストを分析にかけるボタン",
      ]}
    />
  );
}
