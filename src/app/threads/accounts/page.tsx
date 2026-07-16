"use client";

import { useCallback, useEffect, useState } from "react";
import { useThreadsAccountId } from "@/lib/threads-account";
import { api } from "@/lib/threads-client";

interface Account {
  id: string;
  name: string;
  handle: string;
  concept: string;
  logic: string;
  target: string;
  tone: string;
  isActive: boolean;
  sortOrder: number;
  _count?: { competitors: number; drafts: number };
}

const TONE_FIELDS = [
  { key: "一人称", placeholder: "例: 僕 / 私 / わたし" },
  { key: "語尾", placeholder: "例: 断定調。「〜です」は使わない" },
  { key: "絵文字", placeholder: "例: 使わない / 1投稿1個まで" },
  { key: "改行", placeholder: "例: 1〜2文ごとに空行を入れる" },
] as const;

const emptyForm = { name: "", handle: "", concept: "", logic: "", target: "", tone: {} as Record<string, string> };

export default function ThreadsAccountsPage() {
  const [accountId, setAccountId] = useThreadsAccountId();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editing, setEditing] = useState<string | null>(null); // account.id or "new"
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setAccounts(await api<Account[]>("/api/threads/accounts"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const notifyUpdated = () => window.dispatchEvent(new CustomEvent("threads-accounts-updated"));

  const startEdit = (a: Account | null) => {
    setError("");
    if (!a) {
      setForm({ ...emptyForm, tone: {} });
      setEditing("new");
      return;
    }
    let tone: Record<string, string> = {};
    try {
      tone = JSON.parse(a.tone || "{}");
    } catch {
      tone = {};
    }
    setForm({ name: a.name, handle: a.handle, concept: a.concept, logic: a.logic, target: a.target, tone });
    setEditing(a.id);
  };

  const save = async () => {
    if (!form.name.trim() || !form.handle.trim()) {
      setError("表示名とハンドルは必須です");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, tone: JSON.stringify(form.tone) };
      if (editing === "new") {
        const created = await api<Account>("/api/threads/accounts", { method: "POST", body: JSON.stringify(payload) });
        setAccountId(created.id);
      } else {
        await api(`/api/threads/accounts/${editing}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
      setEditing(null);
      await load();
      notifyUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: Account) => {
    await api(`/api/threads/accounts/${a.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !a.isActive }) });
    await load();
    notifyUpdated();
  };

  const remove = async (a: Account) => {
    const label = `${a.name}（@${a.handle}）`;
    if (!confirm(`${label} を削除しますか？\n紐づく競合・収集投稿・投稿案もすべて削除されます。`)) return;
    await api(`/api/threads/accounts/${a.id}`, { method: "DELETE" });
    await load();
    notifyUpdated();
  };

  return (
    <main className="px-4 md:px-6 py-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">アカウント管理</h2>
          <p className="text-sm text-gray-600 mt-1">
            コンセプト・投稿ロジックはオマージュ生成時に必ず注入されます。具体的に書くほど生成品質が上がります。
          </p>
        </div>
        <button
          onClick={() => startEdit(null)}
          className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 whitespace-nowrap"
        >
          + 追加
        </button>
      </div>

      {error && !editing && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>}

      <div className="space-y-3">
        {accounts.map((a) => (
          <div
            key={a.id}
            className={`bg-white rounded-xl border p-4 ${a.id === accountId ? "border-teal-400 ring-1 ring-teal-200" : "border-gray-200"} ${!a.isActive ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900">{a.name}</span>
                  <span className="text-sm text-gray-500">@{a.handle}</span>
                  {a.id === accountId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-bold">選択中</span>
                  )}
                  {!a.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">停止中</span>}
                </div>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{a.concept || "（コンセプト未設定）"}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  競合 {a._count?.competitors ?? 0} / 投稿案 {a._count?.drafts ?? 0}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {a.id !== accountId && a.isActive && (
                  <button onClick={() => setAccountId(a.id)} className="text-xs px-2.5 py-1.5 rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50">
                    切替
                  </button>
                )}
                <button onClick={() => startEdit(a)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                  編集
                </button>
                <button onClick={() => toggleActive(a)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                  {a.isActive ? "停止" : "再開"}
                </button>
                <button onClick={() => remove(a)} className="text-xs px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50">
                  削除
                </button>
              </div>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            まだアカウントがありません。「+ 追加」から運用アカウントを登録してください。
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">{editing === "new" ? "アカウント追加" : "アカウント編集"}</h3>
            {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>}

            <div className="grid md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">表示名 *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="例: 開運メインアカ"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">ハンドル *（@なし）</span>
                <input
                  value={form.handle}
                  onChange={(e) => setForm({ ...form, handle: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="例: kaiun_shindan"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-gray-700">コンセプト（誰に・何を・どう届けるアカウントか）</span>
              <textarea
                value={form.concept}
                onChange={(e) => setForm({ ...form, concept: e.target.value })}
                rows={3}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="例: 30-40代女性向けに、神社×開運の実践的な知識を毎日発信。難しい話をせず「今日からできる」に落とす。"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-700">投稿ロジック（伸ばすための方針・勝ちパターン）</span>
              <textarea
                value={form.logic}
                onChange={(e) => setForm({ ...form, logic: e.target.value })}
                rows={3}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="例: 冒頭は数字か断言でフック。本文は箇条書き中心。締めは保存を促す。共感→具体→行動の順。"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-700">ターゲット</span>
              <textarea
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                rows={2}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="例: 人間関係・お金に漠然と不安がある30-40代女性。スピ初心者。"
              />
            </label>

            <div>
              <span className="text-xs font-medium text-gray-700">口調ルール</span>
              <div className="grid md:grid-cols-2 gap-2 mt-1">
                {TONE_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-[11px] text-gray-500">{f.key}</span>
                    <input
                      value={form.tone[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, tone: { ...form.tone, [f.key]: e.target.value } })}
                      className="mt-0.5 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      placeholder={f.placeholder}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
                キャンセル
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
