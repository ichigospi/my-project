"use client";

import { useState, useEffect } from "react";
import { getApiKey, setApiKey, getChannels } from "@/lib/channel-store";

export default function SettingsPage() {
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [aiApiKey, setAiApiKeyState] = useState("");
  const [saved, setSaved] = useState(false);
  const [channelCount, setChannelCount] = useState(0);
  const [testingYt, setTestingYt] = useState(false);
  const [ytTestResult, setYtTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setYoutubeApiKey(getApiKey("yt_api_key"));
    setAiApiKeyState(getApiKey("ai_api_key"));
    setChannelCount(getChannels().length);
  }, []);

  const handleSave = () => {
    setApiKey("yt_api_key", youtubeApiKey);
    setApiKey("ai_api_key", aiApiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const testYoutubeApi = async () => {
    if (!youtubeApiKey) {
      setYtTestResult({ ok: false, message: "APIキーを入力してください" });
      return;
    }
    setTestingYt(true);
    setYtTestResult(null);
    try {
      const res = await fetch(
        `/api/youtube/channel-info?handle=enmusubiuranaishie&apiKey=${encodeURIComponent(youtubeApiKey)}`
      );
      const data = await res.json();
      if (data.error) {
        setYtTestResult({ ok: false, message: data.error });
      } else {
        setYtTestResult({ ok: true, message: `接続成功！テストチャンネル: ${data.name}（${data.subscribers?.toLocaleString()}人）` });
      }
    } catch {
      setYtTestResult({ ok: false, message: "接続テストに失敗しました" });
    } finally {
      setTestingYt(false);
    }
  };

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
            チャンネル情報・動画データの取得に必要です。
          </p>
          <input
            type="password"
            value={youtubeApiKey}
            onChange={(e) => setYoutubeApiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm font-mono"
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={testYoutubeApi}
              disabled={testingYt}
              className="px-4 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {testingYt ? "テスト中..." : "接続テスト"}
            </button>
            {ytTestResult && (
              <span className={`text-sm ${ytTestResult.ok ? "text-green-600" : "text-red-500"}`}>
                {ytTestResult.message}
              </span>
            )}
          </div>
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
            台本の自動生成に使用。<code className="bg-gray-100 px-1 rounded text-xs">sk-ant-</code> で始まるならClaude API、
            <code className="bg-gray-100 px-1 rounded text-xs">sk-</code> で始まるならOpenAI APIとして自動判別します。
          </p>
          <input
            type="password"
            value={aiApiKey}
            onChange={(e) => setAiApiKeyState(e.target.value)}
            placeholder="sk-ant-... または sk-..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm font-mono"
          />
        </div>

        {/* ステータスサマリ */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-4">現在のステータス</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">YouTube API</span>
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium ${
                youtubeApiKey ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
              }`}>
                <span className={`w-2 h-2 rounded-full ${youtubeApiKey ? "bg-green-500" : "bg-amber-500"}`} />
                {youtubeApiKey ? "設定済み" : "未設定"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">AI API</span>
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium ${
                aiApiKey ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
              }`}>
                <span className={`w-2 h-2 rounded-full ${aiApiKey ? "bg-green-500" : "bg-amber-500"}`} />
                {aiApiKey ? (aiApiKey.startsWith("sk-ant-") ? "Claude API" : "OpenAI API") : "未設定"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">登録チャンネル数</span>
              <span className="text-sm font-medium">{channelCount}チャンネル</span>
            </div>
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
