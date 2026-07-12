"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccounts } from "@/lib/use-dashboard-data";

type UserRow = { id: string; email: string; name: string; role: string; createdAt: string };

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
    </div>
  );
}
