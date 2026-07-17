"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/threads-client";

interface Settings {
  apifyTokenMasked: string;
  apifyActorId: string;
  openaiApiKeyMasked: string;
  scraperEnabled: boolean;
  metricsTiming: string;
  lastCollectAt: string | null;
  lastMetricsAt: string | null;
}

export default function ThreadsSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apifyToken, setApifyToken] = useState("");
  const [apifyActorId, setApifyActorId] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [timing, setTiming] = useState("1, 24, 72, 168");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [scraperMsg, setScraperMsg] = useState("");
  const [scraperBusy, setScraperBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const s = await api<Settings>("/api/threads/settings");
      setSettings(s);
      setApifyActorId(s.apifyActorId);
      try {
        setTiming((JSON.parse(s.metricsTiming) as number[]).join(", "));
      } catch {
        // keep default
      }
    } catch (e) {
      setMessage(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleScraper = async () => {
    if (!settings) return;
    try {
      await api("/api/threads/settings", {
        method: "PATCH",
        body: JSON.stringify({ scraperEnabled: !settings.scraperEnabled }),
      });
      await load();
    } catch (e) {
      setScraperMsg(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const runScraper = async (kind: "test" | "collect" | "metrics") => {
    setScraperBusy(kind);
    setScraperMsg(kind === "test" ? "" : "実行中...（1〜3分かかります。このまま待ってください）");
    try {
      if (kind === "test") {
        const res = await api<{ username: string; plan?: string; actorId: string }>("/api/threads/scraper/test", { method: "POST" });
        setScraperMsg(`✅ 接続OK（アカウント: ${res.username}${res.plan ? ` / プラン: ${res.plan}` : ""} / 使用Actor: ${res.actorId}）`);
      } else if (kind === "collect") {
        const res = await api<{ handles: number; itemsReturned: number; created: number; classified: number; errors: string[] }>(
          "/api/threads/scraper/collect",
          { method: "POST", body: JSON.stringify({}) },
        );
        setScraperMsg(
          res.errors.length > 0
            ? `⚠️ ${res.errors.join(" / ")}（取得${res.itemsReturned}件・新規${res.created}件）`
            : `✅ 競合${res.handles}アカから${res.itemsReturned}件取得 → 新規${res.created}件を登録、${res.classified}件を自動分類しました`,
        );
        await load();
      } else {
        const res = await api<{ itemsReturned: number; updated: number; errors: string[] }>("/api/threads/scraper/metrics", {
          method: "POST",
        });
        setScraperMsg(
          res.errors.length > 0
            ? `⚠️ ${res.errors.join(" / ")}`
            : res.updated === 0
              ? "✅ 実行しました（いま計測タイミングに達している投稿はありませんでした）"
              : `✅ ${res.updated}件の投稿の実績を更新しました`,
        );
        await load();
      }
    } catch (e) {
      setScraperMsg(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setScraperBusy("");
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const timingJson = JSON.stringify(
        timing
          .split(/[,、\s]+/)
          .map((s) => Number(s))
          .filter((n) => n > 0),
      );
      await api("/api/threads/settings", {
        method: "PATCH",
        body: JSON.stringify({
          apifyToken: apifyToken.trim(),
          openaiApiKey: openaiApiKey.trim(),
          apifyActorId: apifyActorId.trim(),
          metricsTiming: timingJson,
        }),
      });
      setApifyToken("");
      setOpenaiApiKey("");
      setMessage("✅ 保存しました");
      await load();
    } catch (e) {
      setMessage(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="px-4 md:px-6 py-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-neutral-100">設定</h2>
        <p className="text-sm text-neutral-400 mt-1">外部サービスのキー保管と計測設定（変更はadmin以上のみ）。</p>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.startsWith("✅") ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border border-rose-500/30 text-rose-300"}`}>
          {message}
        </div>
      )}

      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-neutral-100">🕷 スクレイパー（Apify）— Phase 2</h3>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            競合の自動収集・自投稿の自動計測に使用。契約手順書はオーナーに別途共有します。トークンを保存すると接続機能が有効化できるようになります。
          </p>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-neutral-300">
            APIトークン {settings?.apifyTokenMasked && <span className="text-neutral-500">（保存済み: {settings.apifyTokenMasked}）</span>}
          </span>
          <input
            type="password"
            value={apifyToken}
            onChange={(e) => setApifyToken(e.target.value)}
            className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
            placeholder={settings?.apifyTokenMasked ? "変更する場合のみ入力" : "apify_api_..."}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-neutral-300">Actor ID（使用するスクレイパー。空なら既定を使用）</span>
          <input
            value={apifyActorId}
            onChange={(e) => setApifyActorId(e.target.value)}
            className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
            placeholder="例: xxx/threads-scraper"
          />
        </label>

        {/* 稼働制御 */}
        <div className="border-t border-neutral-800 pt-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="flex items-center gap-2 text-sm text-neutral-200 font-medium">
              <input type="checkbox" checked={settings?.scraperEnabled ?? false} onChange={toggleScraper} />
              自動実行を有効にする（収集: 20時間おき / 計測: 1時間おき）
            </label>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => runScraper("test")}
              disabled={scraperBusy !== ""}
              className="text-xs px-3 py-2 rounded-lg border border-neutral-600 text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
            >
              {scraperBusy === "test" ? "確認中..." : "🔌 接続テスト"}
            </button>
            <button
              onClick={() => runScraper("collect")}
              disabled={scraperBusy !== ""}
              className="text-xs px-3 py-2 rounded-lg bg-white text-black font-bold hover:bg-neutral-200 disabled:opacity-50"
            >
              {scraperBusy === "collect" ? "収集中..." : "📥 今すぐ競合を収集"}
            </button>
            <button
              onClick={() => runScraper("metrics")}
              disabled={scraperBusy !== ""}
              className="text-xs px-3 py-2 rounded-lg bg-white text-black font-bold hover:bg-neutral-200 disabled:opacity-50"
            >
              {scraperBusy === "metrics" ? "計測中..." : "📊 今すぐ実績を計測"}
            </button>
          </div>
          {scraperMsg && (
            <p className={`text-[11px] ${scraperMsg.startsWith("✅") ? "text-emerald-300" : scraperMsg.startsWith("⚠️") ? "text-amber-300" : "text-rose-300"}`}>
              {scraperMsg}
            </p>
          )}
          <p className="text-[10px] text-neutral-600">
            最終収集: {fmtDate(settings?.lastCollectAt)} / 最終計測: {fmtDate(settings?.lastMetricsAt)}。
            自投稿の計測はいいね・コメント・リポストのみ自動更新（表示回数は手動入力のまま）。
          </p>
        </div>
      </div>

      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-neutral-100">🎨 画像生成（OpenAI）— Phase 2</h3>
          <p className="text-[11px] text-neutral-500 mt-0.5">投稿に合った画像の生成に使用（gpt-image-1・従量課金）。</p>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-neutral-300">
            APIキー {settings?.openaiApiKeyMasked && <span className="text-neutral-500">（保存済み: {settings.openaiApiKeyMasked}）</span>}
          </span>
          <input
            type="password"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
            placeholder={settings?.openaiApiKeyMasked ? "変更する場合のみ入力" : "sk-..."}
          />
        </label>
      </div>

      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 space-y-3">
        <h3 className="text-sm font-bold text-neutral-100">⏱ 計測タイミング</h3>
        <label className="block">
          <span className="text-xs font-medium text-neutral-300">投稿後 何時間で実績を記録するか（カンマ区切り）</span>
          <input
            value={timing}
            onChange={(e) => setTiming(e.target.value)}
            className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
            placeholder="1, 24, 72, 168"
          />
          <span className="text-[11px] text-neutral-500">スクレイパー接続後の自動計測で使用します（それまでは手動入力の目安）。</span>
        </label>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-50"
      >
        {saving ? "保存中..." : "保存"}
      </button>

      <p className="text-[11px] text-neutral-600">
        ※ テキスト生成（オマージュ・壁打ち）のAnthropicキーは、従来どおりYTツール側の設定画面で保存されたものを共用しています。
      </p>
    </main>
  );
}
