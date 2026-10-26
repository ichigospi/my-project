"use client";

// プロジェクトの表示中に起きたレンダリングエラーを捕まえて、ページ全体のクラッシュを防ぐ安全網。
// 特定プロジェクトのデータ不整合で画面が開けなくなった場合でも、
// エラー内容の確認・一覧への復帰・ステップの巻き戻しができるようにする。

import React from "react";

interface Props {
  children: React.ReactNode;
  projectTitle?: string;
  onBackToList?: () => void;
  onResetToProposal?: () => void;
}

interface State {
  error: Error | null;
}

export default class StepErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[StepErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="w-full max-w-2xl mx-auto py-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-red-700 mb-2">⚠️ このプロジェクトの表示でエラーが発生しました</h2>
          <p className="text-sm text-gray-700 mb-1">
            「{this.props.projectTitle || "（タイトル未定）"}」のデータに表示できない箇所があります。
            他のプロジェクトには影響ありません。
          </p>
          <p className="text-xs text-gray-500 mb-4 break-all">
            エラー内容: {this.state.error.message || String(this.state.error)}
          </p>
          <div className="flex flex-wrap gap-2">
            {this.props.onBackToList && (
              <button
                onClick={() => { this.setState({ error: null }); this.props.onBackToList?.(); }}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
              >
                一覧に戻る
              </button>
            )}
            {this.props.onResetToProposal && (
              <button
                onClick={() => {
                  if (!confirm("このプロジェクトを構成提案のステップに巻き戻しますか？（生成済みの台本データはそのまま残ります）")) return;
                  this.setState({ error: null });
                  this.props.onResetToProposal?.();
                }}
                className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50"
              >
                構成提案ステップに巻き戻して開く
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-3">
            このエラー画面のスクリーンショットを送ってもらえれば、原因を特定して直せます
          </p>
        </div>
      </div>
    );
  }
}
