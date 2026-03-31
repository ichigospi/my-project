"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getApiKey, setApiKey, getChannels } from "@/lib/channel-store";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8">読み込み中...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [aiApiKey, setAiApiKeyState] = useState("");
  const [saved, setSaved] = useState(false);
  const [channelCount, setChannelCount] = useState(0);
  const [testingYt, setTestingYt] = useState(false);
  const [ytTestResult, setYtTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  // OAuth
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthStatus, setOauthStatus] = useState<"disconnected" | "connected">("disconnected");
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    setYoutubeApiKey(getApiKey("yt_api_key"));
    setAiApiKeyState(getApiKey("ai_api_key"));
    setChannelCount(getChannels().length);
    setOauthClientId(localStorage.getItem("oauth_client_id") || "");
    setOauthClientSecret(localStorage.getItem("oauth_client_secret") || "");
    if (localStorage.getItem("oauth_refresh_token")) setOauthStatus("connected");

    // OAuthコールバック処理
    const authCode = searchParams.get("auth_code");
    if (authCode) {
      handleOAuthCallback(authCode);
    }
  }, [searchParams]);

  const handleOAuthCallback = async (code: string) => {
    const clientId = localStorage.getItem("oauth_client_id");
    const clientSecret = localStorage.getItem("oauth_client_secret");
    if (!clientId || !clientSecret) return;

    setOauthConnecting(true);
    try {
      const res = await fetch("/api/auth/youtube/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code, clientId, clientSecret,
          redirectUri: `${window.location.origin}/api/auth/youtube/callback`,
        }),
      });
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem("oauth_access_token", data.accessToken);
        localStorage.setItem("oauth_refresh_token", data.refreshToken || "");
        setOauthStatus("connected");
        // URLからauth_codeを消す
        window.history.replaceState({}, "", "/settings");
      }
    } catch { /* ignore */ }
    finally { setOauthConnecting(false); }
  };

  const handleOAuthConnect = async () => {
    if (!oauthClientId) return;
    localStorage.setItem("oauth_client_id", oauthClientId);
    localStorage.setItem("oauth_client_secret", oauthClientSecret);

    const res = await fetch(`/api/auth/youtube?clientId=${encodeURIComponent(oauthClientId)}`);
    const data = await res.json();
    if (data.authUrl) {
      window.location.href = data.authUrl;
    }
  };

  const handleOAuthDisconnect = () => {
    localStorage.removeItem("oauth_access_token");
    localStorage.removeItem("oauth_refresh_token");
    setOauthStatus("disconnected");
  };

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

        {/* YouTube Analytics（OAuth連携） */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-1">YouTube Analytics連携（OAuth）</h2>
          <p className="text-sm text-gray-500 mb-4">
            視聴者維持率・インプレッションCTR・トラフィックソース等の詳細分析に必要です。
          </p>

          {oauthStatus === "connected" ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-50 text-green-700">
                <span className="w-2 h-2 rounded-full bg-green-500" /> 連携済み
              </span>
              <button onClick={handleOAuthDisconnect} className="text-sm text-gray-500 hover:text-danger">連携解除</button>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">OAuthクライアントID</label>
                  <input type="text" value={oauthClientId} onChange={(e) => setOauthClientId(e.target.value)}
                    placeholder="xxxxxxxxx.apps.googleusercontent.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">OAuthクライアントシークレット</label>
                  <input type="password" value={oauthClientSecret} onChange={(e) => setOauthClientSecret(e.target.value)}
                    placeholder="GOCSPX-..."
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm font-mono" />
                </div>
              </div>
              <button onClick={handleOAuthConnect} disabled={oauthConnecting || !oauthClientId || !oauthClientSecret}
                className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
                {oauthConnecting ? "接続中..." : "Googleアカウントと連携"}
              </button>
              <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                <p className="text-xs text-amber-800"><strong>設定手順:</strong></p>
                <ol className="text-xs text-amber-700 mt-1 space-y-1 list-decimal list-inside">
                  <li>Google Cloud Console → 認証情報</li>
                  <li>「＋認証情報を作成」→「OAuthクライアントID」</li>
                  <li>アプリの種類: 「ウェブアプリケーション」</li>
                  <li>承認済みリダイレクトURI: <code className="bg-amber-100 px-1 rounded">{typeof window !== "undefined" ? `${window.location.origin}/api/auth/youtube/callback` : ""}</code></li>
                  <li>クライアントIDとシークレットをコピーして上に貼り付け</li>
                  <li>YouTube Analytics APIも有効化してください</li>
                </ol>
              </div>
            </>
          )}
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
