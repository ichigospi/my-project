"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getXAccount, saveXAccount, removeXAccount,
  getXApiCredentials, setXApiCredentials,
  getXBearerToken, setXBearerToken,
  getXPosts, getXSafetyConfig, saveXSafetyConfig,
  getTodayPostCount,
  type XAccountLocal, type XSafetyConfigLocal,
} from "@/lib/x-store";

// ===== アカウント接続 =====
function AccountSection({ account, onConnect, onDisconnect }: {
  account: XAccountLocal | null; onConnect: () => void; onDisconnect: () => void;
}) {
  const [showSetup, setShowSetup] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    const c = getXApiCredentials();
    setClientId(c.clientId);
    setClientSecret(c.clientSecret);
  }, []);

  if (account?.connected) {
    return (
      <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231z" /></svg>
            </div>
            <div>
              <p className="font-semibold text-foreground">{account.displayName || account.username}</p>
              <p className="text-sm text-gray-500">@{account.username}</p>
            </div>
          </div>
          <button onClick={onDisconnect} className="text-sm text-red-500 hover:text-red-700">接続解除</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-3">Xアカウント接続</h2>
      {!showSetup ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">X Developer PortalのOAuth 2.0認証情報を設定してください。</p>
          <div className="flex gap-3">
            <button onClick={() => setShowSetup(true)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">認証情報を設定</button>
            {clientId && <button onClick={onConnect} className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800">Xアカウントを接続</button>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div><label className="block text-xs text-gray-500 mb-1">Client ID</label><input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Client ID" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Client Secret</label><input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Client Secret" /></div>
          <div className="flex gap-2">
            <button onClick={() => { setXApiCredentials(clientId, clientSecret); setShowSetup(false); }} className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800">保存</button>
            <button onClick={() => setShowSetup(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">キャンセル</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 分析サマリー =====
function AnalysisSummary() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<{ avgLikes: number; avgRetweets: number; engagementRate: string; bestHour: number } | null>(null);

  const fetchAnalysis = useCallback(async () => {
    const bearerToken = getXBearerToken();
    if (!bearerToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/x/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "account", bearerToken }) });
      const data = await res.json();
      if (data.analysis) setAnalysis(data.analysis);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  return (
    <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">アカウント分析</h2>
        {getXBearerToken() && <button onClick={fetchAnalysis} disabled={loading} className="text-sm text-accent hover:underline disabled:opacity-50">{loading ? "取得中..." : "更新"}</button>}
      </div>
      {!getXBearerToken() ? (
        <p className="text-sm text-gray-400 text-center py-4">Xアカウントを接続すると分析データが表示されます</p>
      ) : !analysis ? (
        <button onClick={fetchAnalysis} disabled={loading} className="text-sm text-accent hover:underline w-full text-center py-4">{loading ? "分析中..." : "分析を開始"}</button>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-blue-600">{analysis.avgLikes}</p><p className="text-xs text-gray-500 mt-1">平均いいね</p></div>
          <div className="bg-green-50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-green-600">{analysis.avgRetweets}</p><p className="text-xs text-gray-500 mt-1">平均RT</p></div>
          <div className="bg-purple-50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-purple-600">{analysis.engagementRate}%</p><p className="text-xs text-gray-500 mt-1">エンゲージメント率</p></div>
          <div className="bg-orange-50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-orange-600">{analysis.bestHour}時</p><p className="text-xs text-gray-500 mt-1">最適投稿時間</p></div>
        </div>
      )}
    </div>
  );
}

// ===== 投稿キュー =====
function PostQueueSection() {
  const [posts, setPosts] = useState<ReturnType<typeof getXPosts>>([]);
  const todayCount = getTodayPostCount();
  const config = getXSafetyConfig();

  useEffect(() => { setPosts(getXPosts().filter((p) => p.status === "draft" || p.status === "scheduled").slice(0, 5)); }, []);

  return (
    <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">投稿キュー</h2>
        <Link href="/posts" className="text-sm text-accent hover:underline">全投稿 →</Link>
      </div>
      <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-gray-500 mb-1"><span>本日の投稿</span><span>{todayCount}/{config.maxDailyPosts}</span></div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full ${todayCount >= config.maxDailyPosts ? "bg-red-500" : todayCount >= config.maxDailyPosts * 0.7 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${Math.min((todayCount / config.maxDailyPosts) * 100, 100)}%` }} />
          </div>
        </div>
      </div>
      {posts.length === 0 ? (
        <div className="text-center py-4"><p className="text-sm text-gray-400 mb-2">下書き・予約投稿はありません</p><Link href="/posts" className="text-sm text-accent hover:underline">投稿を作成 →</Link></div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div key={post.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className={`text-xs px-2 py-0.5 rounded-full ${post.status === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{post.status === "scheduled" ? "予約" : "下書き"}</span>
              <p className="text-sm text-foreground flex-1 truncate">{post.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== 安全設定 =====
function SafetySection() {
  const [config, setConfig] = useState<XSafetyConfigLocal>(getXSafetyConfig());
  const update = (key: keyof XSafetyConfigLocal, value: number | boolean) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    saveXSafetyConfig(updated);
  };

  return (
    <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">安全設定（BAN対策）</h2>
      <div className="space-y-3">
        {[
          { label: "1日の投稿上限", key: "maxDailyPosts" as const, options: [5, 8, 10, 15], suffix: "件" },
          { label: "最小投稿間隔", key: "minIntervalMinutes" as const, options: [15, 30, 60, 120], suffix: "分" },
          { label: "リンク付き投稿上限/日", key: "maxDailyLinks" as const, options: [2, 3, 5], suffix: "件" },
        ].map(({ label, key, options, suffix }) => (
          <div key={key} className="flex items-center justify-between">
            <label className="text-sm text-gray-600">{label}</label>
            <select value={config[key] as number} onChange={(e) => update(key, Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              {options.map((n) => <option key={n} value={n}>{n}{suffix}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== クイックアクション =====
function QuickActions() {
  const actions = [
    { label: "動画宣伝ツイート", href: "/posts?action=generate&type=promotion", color: "bg-blue-50 text-blue-600 hover:bg-blue-100", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
    { label: "今日の占い投稿", href: "/posts?action=generate&type=daily", color: "bg-purple-50 text-purple-600 hover:bg-purple-100", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
    { label: "トレンド分析", href: "/analyze", color: "bg-green-50 text-green-600 hover:bg-green-100", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
    { label: "記事作成", href: "/articles", color: "bg-orange-50 text-orange-600 hover:bg-orange-100", icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" },
  ];

  return (
    <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">クイックアクション</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className={`flex flex-col items-center gap-2 p-5 rounded-xl transition-colors ${a.color}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={a.icon} /></svg>
            <span className="text-sm font-medium text-center">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ===== メインページ =====
function DashboardContent() {
  const searchParams = useSearchParams();
  const [account, setAccount] = useState<XAccountLocal | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setAccount(getXAccount()); setLoaded(true); }, []);

  // OAuth コールバック処理
  useEffect(() => {
    const authCode = searchParams.get("auth_code");
    if (!authCode) return;
    const codeVerifier = sessionStorage.getItem("x_code_verifier");
    if (!codeVerifier) return;
    const creds = getXApiCredentials();
    if (!creds.clientId || !creds.clientSecret) return;

    (async () => {
      try {
        const res = await fetch("/api/x/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: authCode, clientId: creds.clientId, clientSecret: creds.clientSecret, codeVerifier }) });
        const data = await res.json();
        if (data.access_token) {
          setXBearerToken(data.access_token);
          const meRes = await fetch("/api/x/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "me", bearerToken: data.access_token }) });
          const meData = await meRes.json();
          const acc: XAccountLocal = { username: meData.user?.username || "unknown", displayName: meData.user?.name || "", connected: true, connectedAt: new Date().toISOString() };
          saveXAccount(acc); setAccount(acc);
          sessionStorage.removeItem("x_code_verifier");
          window.history.replaceState({}, "", "/");
        }
      } catch { /* */ }
    })();
  }, [searchParams]);

  const handleConnect = async () => {
    const creds = getXApiCredentials();
    if (!creds.clientId) { alert("Client IDを先に設定してください"); return; }
    try {
      const res = await fetch(`/api/x/auth?clientId=${creds.clientId}`);
      const data = await res.json();
      if (data.authUrl) { sessionStorage.setItem("x_code_verifier", data.codeVerifier); window.location.href = data.authUrl; }
    } catch { alert("認証URLの生成に失敗しました"); }
  };

  const handleDisconnect = () => {
    if (!confirm("Xアカウントの接続を解除しますか？")) return;
    removeXAccount(); setXBearerToken(""); setAccount(null);
  };

  if (!loaded) return <div className="p-8"><h1 className="text-2xl font-bold">X自動化ツール</h1><p className="text-sm text-gray-400 mt-1">読み込み中...</p></div>;

  return (
    <div className="p-8 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">X（Twitter）自動分析・投稿生成・自動投稿・記事作成</p>
      </div>
      <AccountSection account={account} onConnect={handleConnect} onDisconnect={handleDisconnect} />
      <QuickActions />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnalysisSummary />
        <PostQueueSection />
      </div>
      <SafetySection />
    </div>
  );
}

export default function DashboardPage() {
  return <Suspense fallback={<div className="p-8"><h1 className="text-2xl font-bold">X自動化ツール</h1><p className="text-sm text-gray-400 mt-1">読み込み中...</p></div>}><DashboardContent /></Suspense>;
}
