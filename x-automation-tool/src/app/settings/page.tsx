"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getXApiCredentials, setXApiCredentials,
  getAiApiKey, setAiApiKey,
  getXSafetyConfig, saveXSafetyConfig,
  getXAccount,
  type XSafetyConfigLocal,
} from "@/lib/x-store";

export default function SettingsPage() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [showAiKey, setShowAiKey] = useState(false);
  const [config, setConfig] = useState<XSafetyConfigLocal>(getXSafetyConfig());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const creds = getXApiCredentials();
    setClientId(creds.clientId);
    setClientSecret(creds.clientSecret);
    setAiKey(getAiApiKey());
    setConfig(getXSafetyConfig());
  }, []);

  const handleSave = () => {
    setXApiCredentials(clientId, clientSecret);
    setAiApiKey(aiKey);
    saveXSafetyConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const account = getXAccount();

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">設定</h1><p className="text-sm text-gray-500 mt-1">API接続・安全設定</p></div>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← ダッシュボード</Link>
      </div>

      {/* X API設定 */}
      <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">X API設定</h2>
        {account?.connected && <p className="text-sm text-green-600 mb-3">接続済み: @{account.username}</p>}
        <div className="space-y-3">
          <div><label className="block text-sm text-gray-600 mb-1">Client ID</label><input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="X Developer PortalのClient ID" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">Client Secret</label><input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Client Secret" /></div>
        </div>
      </div>

      {/* AI API設定 */}
      <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">AI API設定</h2>
        <p className="text-xs text-gray-400 mb-3">Claude API (sk-ant-...) または OpenAI API キー</p>
        <div className="relative">
          <input type={showAiKey ? "text" : "password"} value={aiKey} onChange={(e) => setAiKey(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-16" placeholder="APIキー" />
          <button onClick={() => setShowAiKey(!showAiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">{showAiKey ? "隠す" : "表示"}</button>
        </div>
      </div>

      {/* 安全設定 */}
      <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">安全設定（BAN対策）</h2>
        <div className="space-y-4">
          {[
            { label: "1日の投稿上限", key: "maxDailyPosts" as const, options: [5, 8, 10, 15], suffix: "件" },
            { label: "最小投稿間隔", key: "minIntervalMinutes" as const, options: [15, 30, 60, 120], suffix: "分" },
            { label: "リンク付き投稿上限/日", key: "maxDailyLinks" as const, options: [2, 3, 5], suffix: "件" },
            { label: "重複検知閾値", key: "similarityThreshold" as const, options: [0.6, 0.7, 0.8, 0.9], suffix: "%", format: (n: number) => `${(n * 100).toFixed(0)}%` },
          ].map(({ label, key, options, suffix, format }) => (
            <div key={key} className="flex items-center justify-between">
              <label className="text-sm text-gray-600">{label}</label>
              <select value={config[key] as number} onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                {options.map((n) => <option key={n} value={n}>{format ? format(n) : `${n}${suffix}`}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} className="w-full py-3 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800">
        {saved ? "保存しました" : "設定を保存"}
      </button>
    </div>
  );
}
