"use client";

import XPostSkeleton from "@/components/XPostSkeleton";

export default function AnalysisPage() {
  return (
    <XPostSkeleton
      title="伸びてるポスト分析"
      emoji="🔍"
      description="収集したポストから構成・フック・強化要素・自アカ転用ヒントをAI抽出"
      upcoming={[
        "分析対象ポスト選択（競合ポスト一覧から複数選択）",
        "分析タイプ選択（自動分析 / カスタム指示）",
        "AI分析実行（Claude プロンプトキャッシュ活用）",
        "分析結果表示（構造タイプ・フック・強化要素・転用ヒント）",
        "過去分析一覧",
        "「この分析を生成のベースに使う」ボタン",
      ]}
    />
  );
}
