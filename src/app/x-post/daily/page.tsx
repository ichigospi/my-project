"use client";

import XPostSkeleton from "@/components/XPostSkeleton";

export default function DailyPlanPage() {
  return (
    <XPostSkeleton
      title="デイリープラン"
      emoji="📅"
      description="今日の5ポスト計画 + 教育バランス + 連投/引用RTシーケンス設計"
      upcoming={[
        "過去N日の教育バランス計算（目的=毎日 / 信用=2日に1回 等）",
        "5スロットの構成設計（教育タイプ + 接続タイプ）",
        "シーケンスパターンライブラリの活用",
        "AIが各スロットのテーマを提案",
        "スロット単位で生成画面に接続",
        "設定画面（1日のポスト本数 / 教育頻度 / パターン使用率）",
        "過去のプラン履歴",
      ]}
    />
  );
}
