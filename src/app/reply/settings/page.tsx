// 設定: ペルソナ補正・文体ルール・事業情報・承認モード
"use client";

import { useEffect, useState } from "react";

interface Settings {
  personaNote: string;
  toneNote: string;
  businessNote: string;
  approvalMode: "direct" | "approval";
}

export default function ReplySettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    personaNote: "",
    toneNote: "",
    businessNote: "",
    approvalMode: "direct",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/reply/settings");
        const data = await res.json();
        if (res.ok) setSettings(data);
        else setError(data.error || "読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/reply/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存に失敗しました（オーナー/管理者のみ変更可能）");
        return;
      }
      setMessage("保存しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-400 text-center py-10">読み込み中...</p>;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-1">
        <h2 className="text-sm font-semibold text-gray-900">ベース人格について</h2>
        <p className="text-sm text-gray-500">
          このツールには「プロの占い師 兼 スピリチュアルマーケター」としての判断基準（共感ファースト、恐怖を煽らない、押し売りしない、危険な相談は本人対応に回す等）が最初から組み込まれています。
          以下の設定は、そのベース人格に<strong className="text-gray-700">上乗せ・上書き</strong>されます。
        </p>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">事業・商品の前提情報</h2>
          <p className="text-xs text-gray-500">商品名・価格・提供形式・納期など。返信の中で正確に案内するために必要です。</p>
        </div>
        <textarea
          value={settings.businessNote}
          onChange={(e) => setSettings({ ...settings, businessNote: e.target.value })}
          placeholder={"例:\n・神社選定鑑定 7,980円（申込から3日以内に納品）\n・返金は原則不可（規約に明記済み）\n・鑑定の追加質問は1回まで無料"}
          rows={5}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">人格・判断の補正（オーナーの脳）</h2>
          <p className="text-xs text-gray-500">ベース人格と判断が違う部分をここに書くと、こちらが優先されます。</p>
        </div>
        <textarea
          value={settings.personaNote}
          onChange={(e) => setSettings({ ...settings, personaNote: e.target.value })}
          placeholder={"例:\n・私はロジカル寄りの鑑定スタイル。ふわふわした表現より具体的な行動提案を重視\n・リピート案内は感想をもらった時だけ。こちらから鑑定を勧めることはしない"}
          rows={5}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">文体・口調のルール</h2>
          <p className="text-xs text-gray-500">呼びかけ方、絵文字の使い方、締めの定型文など。</p>
        </div>
        <textarea
          value={settings.toneNote}
          onChange={(e) => setSettings({ ...settings, toneNote: e.target.value })}
          placeholder={"例:\n・呼びかけは「お名前＋さま」\n・絵文字は1通に2〜3個まで（🌙✨🙏をよく使う）\n・締めは「あなたの毎日が佳き流れでありますように🌙」"}
          rows={5}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">承認フロー</h2>
          <p className="text-xs text-gray-500">外注スタッフが生成した返信をそのまま送れるか、オーナーの承認を必須にするか。</p>
        </div>
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="radio"
              checked={settings.approvalMode === "direct"}
              onChange={() => setSettings({ ...settings, approvalMode: "direct" })}
              className="mt-1"
            />
            <span>
              <strong>直接送信モード</strong> — スタッフが確認してそのまま送信。エスカレーション案件のみ本人対応
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="radio"
              checked={settings.approvalMode === "approval"}
              onChange={() => setSettings({ ...settings, approvalMode: "approval" })}
              className="mt-1"
            />
            <span>
              <strong>承認必須モード</strong> — 全ての返信をオーナー/管理者が「履歴・承認」タブで承認してから送信
            </span>
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {saving ? "保存中..." : "設定を保存"}
        </button>
        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
