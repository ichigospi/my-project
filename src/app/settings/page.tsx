"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getApiKey, setApiKey } from "@/lib/settings-store";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8">読み込み中...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

interface UserInfo { id: string; name: string; email: string; role: string; createdAt: string }
interface InviteInfo { id: string; email: string; role: string; token: string; expiresAt: string }

const ROLE_LABELS: Record<string, string> = { owner: "オーナー", admin: "管理者", editor: "編集者", viewer: "閲覧者" };

function SettingsContent() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role || "";
  const isAdmin = userRole === "owner" || userRole === "admin";

  const [aiApiKey, setAiApiKeyState] = useState("");
  const [lineChannelId, setLineChannelId] = useState("");
  const [lineChannelSecret, setLineChannelSecret] = useState("");
  const [lineAccessToken, setLineAccessToken] = useState("");
  const [utageApiKey, setUtageApiKey] = useState("");
  const [utageBaseUrl, setUtageBaseUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);

  // ユーザー管理
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [invites, setInvites] = useState<InviteInfo[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch { /* ignore */ }
  }, []);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/users/invite");
      const data = await res.json();
      if (data.invites) setInvites(data.invites);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setAiApiKeyState(getApiKey("ai_api_key"));
    setLineChannelId(getApiKey("line_channel_id"));
    setLineChannelSecret(getApiKey("line_channel_secret"));
    setLineAccessToken(getApiKey("line_access_token"));
    setUtageApiKey(getApiKey("utage_api_key"));
    setUtageBaseUrl(getApiKey("utage_base_url"));
    fetchUsers();
    fetchInvites();
  }, [fetchUsers, fetchInvites]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (data.error) {
        setInviteResult({ ok: false, message: data.error });
      } else {
        setInviteResult({ ok: true, message: "招待リンクを発行しました" });
        setInviteEmail("");
        fetchInvites();
      }
    } catch {
      setInviteResult({ ok: false, message: "エラーが発生しました" });
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`${userName} を削除しますか？`)) return;
    await fetch(`/api/users/${userId}`, { method: "DELETE" });
    fetchUsers();
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/register?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(""), 2000);
  };

  const handleSave = () => {
    setApiKey("ai_api_key", aiApiKey);
    setApiKey("line_channel_id", lineChannelId);
    setApiKey("line_channel_secret", lineChannelSecret);
    setApiKey("line_access_token", lineAccessToken);
    setApiKey("utage_api_key", utageApiKey);
    setApiKey("utage_base_url", utageBaseUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">設定</h1>
        <p className="text-gray-500 mt-1">API連携・アカウント管理</p>
      </div>

      <div className="space-y-6">
        {/* AI APIキー */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-1">AI APIキー（Claude / OpenAI）</h2>
          <p className="text-sm text-gray-500 mb-4">
            分析・文章生成に使用。<code className="bg-gray-100 px-1 rounded text-xs">sk-ant-</code>ならClaude、
            <code className="bg-gray-100 px-1 rounded text-xs">sk-</code>ならOpenAIとして自動判別。
          </p>
          <div className="relative">
            <input
              type={showAiKey ? "text" : "password"}
              value={aiApiKey}
              onChange={(e) => setAiApiKeyState(e.target.value)}
              placeholder="sk-ant-... または sk-..."
              className="w-full px-4 py-2.5 pr-16 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm font-mono"
            />
            <button type="button" onClick={() => setShowAiKey(!showAiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700">
              {showAiKey ? "隠す" : "表示"}
            </button>
          </div>
        </div>

        {/* LINE Messaging API */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-1">LINE Messaging API</h2>
          <p className="text-sm text-gray-500 mb-4">LINE公式アカウントとの連携設定</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">チャンネルID</label>
              <input type="text" value={lineChannelId} onChange={(e) => setLineChannelId(e.target.value)}
                placeholder="1234567890" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">チャンネルシークレット</label>
              <input type="password" value={lineChannelSecret} onChange={(e) => setLineChannelSecret(e.target.value)}
                placeholder="..." className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">チャンネルアクセストークン</label>
              <input type="password" value={lineAccessToken} onChange={(e) => setLineAccessToken(e.target.value)}
                placeholder="..." className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm font-mono" />
            </div>
          </div>
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800"><strong>設定手順:</strong></p>
            <ol className="text-xs text-blue-700 mt-1 space-y-1 list-decimal list-inside">
              <li>LINE Developers にアクセス</li>
              <li>Messaging APIチャンネルを作成</li>
              <li>チャンネルID・シークレットをコピー</li>
              <li>チャンネルアクセストークンを発行してコピー</li>
            </ol>
          </div>
        </div>

        {/* UTAGE連携 */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-1">UTAGE連携</h2>
          <p className="text-sm text-gray-500 mb-4">顧客管理・購入データの同期に使用</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">APIキー</label>
              <input type="password" value={utageApiKey} onChange={(e) => setUtageApiKey(e.target.value)}
                placeholder="..." className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ベースURL</label>
              <input type="url" value={utageBaseUrl} onChange={(e) => setUtageBaseUrl(e.target.value)}
                placeholder="https://..." className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm font-mono" />
            </div>
          </div>
        </div>

        {/* ステータスサマリ */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-4">接続ステータス</h2>
          <div className="space-y-3">
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
              <span className="text-sm text-gray-600">LINE API</span>
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium ${
                lineAccessToken ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
              }`}>
                <span className={`w-2 h-2 rounded-full ${lineAccessToken ? "bg-green-500" : "bg-amber-500"}`} />
                {lineAccessToken ? "接続済み" : "未設定"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">UTAGE</span>
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium ${
                utageApiKey ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
              }`}>
                <span className={`w-2 h-2 rounded-full ${utageApiKey ? "bg-green-500" : "bg-amber-500"}`} />
                {utageApiKey ? "接続済み" : "未設定"}
              </span>
            </div>
          </div>
        </div>

        {/* ユーザー管理 */}
        {isAdmin && (
          <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold mb-4">ユーザー管理</h2>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">登録ユーザー</h3>
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-sm font-medium">{u.name}</span>
                        <span className="text-xs text-gray-500 ml-2">{u.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.role === "owner" ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
                          {ROLE_LABELS[u.role]}
                        </span>
                      ) : (
                        <select value={u.role} onChange={(e) => handleChangeRole(u.id, e.target.value)}
                          className="px-2 py-1 rounded border border-gray-200 text-xs outline-none">
                          <option value="admin">管理者</option>
                          <option value="editor">編集者</option>
                          <option value="viewer">閲覧者</option>
                        </select>
                      )}
                      {u.role !== "owner" && (
                        <button onClick={() => handleDeleteUser(u.id, u.name)}
                          className="text-gray-400 hover:text-red-500 text-sm">&times;</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">メンバーを招待</h3>
              <div className="flex gap-2">
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="メールアドレス" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                  <option value="admin">管理者</option>
                  <option value="editor">編集者</option>
                  <option value="viewer">閲覧者</option>
                </select>
                <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
                  {inviting ? "発行中..." : "招待リンク発行"}
                </button>
              </div>
              {inviteResult && (
                <p className={`text-sm mt-2 ${inviteResult.ok ? "text-green-600" : "text-red-500"}`}>
                  {inviteResult.message}
                </p>
              )}
            </div>

            {invites.length > 0 && (
              <div className="border-t border-gray-100 pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">発行済み招待リンク</h3>
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between bg-yellow-50 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-sm">{inv.email}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({ROLE_LABELS[inv.role]}) 期限: {new Date(inv.expiresAt).toLocaleString("ja-JP")}
                        </span>
                      </div>
                      <button onClick={() => copyInviteLink(inv.token)}
                        className="px-3 py-1 rounded-lg border border-gray-200 text-xs hover:bg-white">
                        {copiedToken === inv.token ? "コピー済み" : "リンクをコピー"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 保存ボタン */}
        <button onClick={handleSave}
          className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors">
          {saved ? "保存しました！" : "設定を保存"}
        </button>
      </div>
    </div>
  );
}
