"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccounts } from "@/lib/use-dashboard-data";
import { SALE_CATEGORIES } from "@/lib/domain";

type UserRow = { id: string; email: string; name: string; role: string; createdAt: string };

type CategoryRule = { keyword: string; category: string };

type IntegrationData = {
  ingest: { secret: string; webhookUrl: string };
  base: {
    clientId: string | null;
    hasClientSecret: boolean;
    connected: boolean;
    defaultAccountId: string | null;
    defaultCategory: string;
    rules: CategoryRule[];
    lastSyncAt: string | null;
    lastSyncResult: string | null;
    redirectUri: string;
  };
};

const ROLE_LABELS: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  editor: "編集者",
  viewer: "閲覧者",
};

const PRESET_COLORS = ["#8b5cf6", "#ec4899", "#3b82f6", "#0d9488", "#f59e0b", "#ef4444"];

const inputClass =
  "w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400";

export default function SettingsPage() {
  const { accounts, reload } = useAccounts();
  const [message, setMessage] = useState("");

  // アカウント追加
  const [accName, setAccName] = useState("");
  const [accColor, setAccColor] = useState(PRESET_COLORS[0]);

  // メンバー
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersError, setUsersError] = useState("");
  const [uName, setUName] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uPassword, setUPassword] = useState("");
  const [uRole, setURole] = useState("editor");

  // 連携設定
  const [integ, setInteg] = useState<IntegrationData | null>(null);
  const [baseClientId, setBaseClientId] = useState("");
  const [baseClientSecret, setBaseClientSecret] = useState("");
  const [baseAccount, setBaseAccount] = useState("");
  const [baseCategory, setBaseCategory] = useState("paid_reading");
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [syncing, setSyncing] = useState(false);

  const reloadIntegrations = useCallback(() => {
    fetch("/api/integrations")
      .then(async (r) => {
        if (!r.ok) return;
        const d: IntegrationData = await r.json();
        setInteg(d);
        setBaseClientId(d.base.clientId ?? "");
        setBaseAccount(d.base.defaultAccountId ?? "");
        setBaseCategory(d.base.defaultCategory);
        setRules(d.base.rules);
      })
      .catch(() => {});
  }, []);
  useEffect(reloadIntegrations, [reloadIntegrations]);

  const reloadUsers = useCallback(() => {
    fetch("/api/users")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setUsersError(d.error || "メンバー一覧を取得できません");
          return;
        }
        setUsers(d.users ?? []);
        setUsersError("");
      })
      .catch(() => {});
  }, []);
  useEffect(reloadUsers, [reloadUsers]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const addAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: accName, color: accColor }),
    });
    if (res.ok) {
      setAccName("");
      flash("アカウントを追加しました");
      reload();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error || "追加に失敗しました");
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => flash("コピーしました"),
      () => flash("コピーに失敗しました")
    );
  };

  const saveBase = async () => {
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: baseClientId,
        clientSecret: baseClientSecret || undefined,
        defaultAccountId: baseAccount,
        defaultCategory: baseCategory,
        rules,
      }),
    });
    if (res.ok) {
      setBaseClientSecret("");
      flash("BASE設定を保存しました");
      reloadIntegrations();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error || "保存に失敗しました");
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    const res = await fetch("/api/base/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ifStale: false }),
    });
    setSyncing(false);
    const d = await res.json().catch(() => ({}));
    flash(d.message || "同期しました");
    reloadIntegrations();
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: uName, email: uEmail, password: uPassword, role: uRole }),
    });
    if (res.ok) {
      setUName("");
      setUEmail("");
      setUPassword("");
      flash("メンバーを追加しました");
      reloadUsers();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error || "追加に失敗しました");
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto p-5 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">設定</h2>
        {message && (
          <span className="text-sm font-medium text-violet-600 bg-violet-50 rounded-full px-4 py-1.5">{message}</span>
        )}
      </div>

      {/* アカウント管理 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6 space-y-4">
        <h3 className="font-bold text-gray-900">アカウント（運用単位）</h3>
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <span key={a.id} className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm border border-gray-200 bg-gray-50 text-gray-700">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
              {a.name}
            </span>
          ))}
          {accounts.length === 0 && <span className="text-sm text-gray-400">まだアカウントがありません</span>}
        </div>
        <form onSubmit={addAccount} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-40">
            <label className="text-xs text-gray-500">アカウント名</label>
            <input type="text" required placeholder="例: 恋愛" value={accName} onChange={(e) => setAccName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-500">カラー</label>
            <div className="flex gap-1.5 py-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccColor(c)}
                  className={`w-7 h-7 rounded-full border-2 ${accColor === c ? "border-gray-800" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <button type="submit" className="px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors">
            追加
          </button>
        </form>
      </div>

      {/* メンバー管理 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6 space-y-4 mb-8">
        <h3 className="font-bold text-gray-900">メンバー</h3>
        {usersError ? (
          <div className="text-sm text-gray-400">{usersError}</div>
        ) : (
          <div className="space-y-1">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="font-medium text-gray-900">{u.name}</span>
                <span className="text-gray-400">{u.email}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={addUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500">名前</label>
            <input type="text" required value={uName} onChange={(e) => setUName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-500">メール</label>
            <input type="email" required value={uEmail} onChange={(e) => setUEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-500">初期パスワード</label>
            <input type="password" required minLength={8} value={uPassword} onChange={(e) => setUPassword(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-500">権限</label>
            <select value={uRole} onChange={(e) => setURole(e.target.value)} className={inputClass}>
              <option value="admin">管理者</option>
              <option value="editor">編集者</option>
              <option value="viewer">閲覧者</option>
            </select>
          </div>
          <button type="submit" className="px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors">
            メンバー追加
          </button>
        </form>
        <p className="text-xs text-gray-400">
          権限: 管理者=メンバー・アカウント管理可 / 編集者=実績入力可 / 閲覧者=閲覧のみ
        </p>
      </div>

      {/* 連携（自動記録） */}
      {integ && (
        <div className="space-y-6 mb-8">
          {/* UTAGE */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6 space-y-4">
            <h3 className="font-bold text-gray-900">UTAGE連携（リストイン・無料鑑定の自動記録）</h3>
            <p className="text-sm text-gray-500">
              UTAGEのシナリオ/ファネルの「アクション」にwebhook送信を追加すると、登録や申込がリアルタイムでこのツールに記録されます。詳しい手順は{" "}
              <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5">biz-app/docs/integrations.md</code> 参照。
            </p>
            <div>
              <label className="text-xs text-gray-500">Webhook URL（例: リストイン用。event と account を書き換えて使う）</label>
              <div className="flex gap-2 mt-1">
                <input
                  readOnly
                  value={`${integ.ingest.webhookUrl}&event=list_in&account=<アカウントID>&source=youtube`}
                  className={`${inputClass} font-mono text-xs`}
                />
                <button
                  onClick={() => copyText(`${integ.ingest.webhookUrl}&event=list_in&account=<アカウントID>&source=youtube`)}
                  className="shrink-0 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-violet-300 transition-colors"
                >
                  コピー
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">アカウントID（URLの account= に指定する値）</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => copyText(a.id)}
                    title="クリックでIDをコピー"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:border-violet-300 transition-colors font-mono"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                    {a.name}: {a.id}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400">
              event: list_in（リストイン）/ free_apply（無料鑑定申込）/ free_sent（鑑定送付）、source: threads / insta / x / youtube / other
            </p>
          </div>

          {/* BASE */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-gray-900">BASE連携（売上の自動計上）</h3>
              {integ.base.connected ? (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">接続済み</span>
              ) : (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">未接続</span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              BASE Developersでアプリ登録し（コールバックURLに下記を指定）、client_id / client_secret を保存 → 「BASEと接続」で認可すると、注文が自動で売上に取り込まれます（ダッシュボード表示時に1時間おき + 手動同期）。
            </p>
            <div>
              <label className="text-xs text-gray-500">コールバックURL（BASE Developersのアプリ登録で指定）</label>
              <div className="flex gap-2 mt-1">
                <input readOnly value={integ.base.redirectUri} className={`${inputClass} font-mono text-xs`} />
                <button
                  onClick={() => copyText(integ.base.redirectUri)}
                  className="shrink-0 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-violet-300 transition-colors"
                >
                  コピー
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">client_id</label>
                <input type="text" value={baseClientId} onChange={(e) => setBaseClientId(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-gray-500">
                  client_secret {integ.base.hasClientSecret && "（保存済み・変更時のみ入力）"}
                </label>
                <input type="password" value={baseClientSecret} onChange={(e) => setBaseClientSecret(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-gray-500">同期先アカウント</label>
                <select value={baseAccount} onChange={(e) => setBaseAccount(e.target.value)} className={inputClass}>
                  <option value="">選択してください</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">デフォルトカテゴリ（ルールに一致しない商品）</label>
                <select value={baseCategory} onChange={(e) => setBaseCategory(e.target.value)} className={inputClass}>
                  {SALE_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">商品名→カテゴリ判定ルール（上から順に部分一致）</label>
              <div className="space-y-2 mt-1">
                {rules.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="商品名に含まれるキーワード（例: 継続）"
                      value={r.keyword}
                      onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, keyword: e.target.value } : x)))}
                      className={inputClass}
                    />
                    <select
                      value={r.category}
                      onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}
                      className={`${inputClass} max-w-40`}
                    >
                      {SALE_CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setRules(rules.filter((_, j) => j !== i))}
                      className="shrink-0 px-3 rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setRules([...rules, { keyword: "", category: "upsell" }])}
                  className="text-sm text-violet-600 hover:text-violet-700"
                >
                  + ルールを追加
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={saveBase} className="px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors">
                設定を保存
              </button>
              <a
                href="/api/base/auth"
                className="px-5 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-violet-300 transition-colors"
              >
                BASEと接続
              </a>
              {integ.base.connected && (
                <button
                  onClick={syncNow}
                  disabled={syncing}
                  className="px-5 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-violet-300 disabled:opacity-50 transition-colors"
                >
                  {syncing ? "同期中..." : "今すぐ同期"}
                </button>
              )}
              {integ.base.lastSyncResult && (
                <span className="text-xs text-gray-400">
                  最終同期: {integ.base.lastSyncAt?.slice(0, 16).replace("T", " ")} — {integ.base.lastSyncResult}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
