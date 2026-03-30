"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("yt_api_key", youtubeApiKey);
      localStorage.setItem("ai_api_key", aiApiKey);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  useState(() => {
    if (typeof window !== "undefined") {
      setYoutubeApiKey(localStorage.getItem("yt_api_key") || "");
      setAiApiKey(localStorage.getItem("ai_api_key") || "");
    }
  });

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">設定</h1>
        <p className="text-gray-500 mt-1">APIキーや各種設定を管理</p>
      </div>

      <div className="space-y-6">
        {/* YouTube APIキー */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-1">YouTube Data APIキー</h2>
          <p className="text-sm text-gray-500 mb-4">
            リアルタイムのチャンネル・動画データ取得に必要です。
            <span className="text-accent">Google Cloud Console &gt; API &gt; YouTube Data API v3</span> から取得できます。
          </p>
          <input
            type="password"
            value={youtubeApiKey}
            onChange={(e) => setYoutubeApiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm font-mono"
          />
          <div className="mt-3 p-3 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-800">
              <strong>取得手順:</strong>
            </p>
            <ol className="text-xs text-amber-700 mt-1 space-y-1 list-decimal list-inside">
              <li>Google Cloud Consoleにアクセス</li>
              <li>プロジェクトを作成（または既存を選択）</li>
              <li>「YouTube Data API v3」を有効化</li>
              <li>認証情報 &gt; 認証情報を作成 &gt; APIキー</li>
              <li>キーをコピーして上に貼り付け</li>
            </ol>
          </div>
        </div>

        {/* AI APIキー */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-1">AI APIキー（Claude / OpenAI）</h2>
          <p className="text-sm text-gray-500 mb-4">
            AI台本自動生成に使用します。Claude APIまたはOpenAI APIに対応。
          </p>
          <input
            type="password"
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
            placeholder="sk-ant-... または sk-..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm font-mono"
          />
        </div>

        {/* データソース情報 */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-1">データソース</h2>
          <p className="text-sm text-gray-500 mb-4">現在のデータモード</p>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
            youtubeApiKey ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}>
            <span className={`w-2 h-2 rounded-full ${youtubeApiKey ? "bg-green-500" : "bg-amber-500"}`} />
            {youtubeApiKey ? "ライブAPIデータ" : "デモモード（サンプルデータ）"}
          </div>
        </div>

        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          {saved ? "保存しました！" : "設定を保存"}
        </button>
      </div>
    </div>
  );
}
