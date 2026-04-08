"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function RegisterContent() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<{ valid: boolean; email: string; role: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    fetch(`/api/users/register?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        setInvite(data);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // 登録成功 → 自動ログイン
      const result = await signIn("credentials", {
        email: invite?.email,
        password,
        redirect: false,
      });

      if (result?.error) {
        router.push("/login");
      } else {
        router.push("/");
      }
    } catch {
      setError("エラーが発生しました");
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">招待リンクを確認中...</div>
      </div>
    );
  }

  if (!token || !invite?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm text-center">
          <h1 className="text-lg font-bold mb-2">無効な招待リンク</h1>
          <p className="text-sm text-gray-500 mb-4">
            この招待リンクは無効または期限切れです。管理者に新しいリンクを発行してもらってください。
          </p>
          <a href="/login" className="text-accent text-sm hover:underline">ログインページへ</a>
        </div>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: "管理者",
    editor: "編集者",
    viewer: "閲覧者",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-xl font-bold text-center mb-1">アカウント登録</h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            招待されたメンバーとして登録します
          </p>

          <div className="bg-accent/5 rounded-lg p-3 mb-4 text-sm">
            <div className="text-gray-600">メールアドレス: <strong>{invite.email}</strong></div>
            <div className="text-gray-600">ロール: <strong>{roleLabels[invite.role] || invite.role}</strong></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">名前</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                placeholder="山田太郎"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">パスワード（8文字以上）</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? "登録中..." : "アカウントを作成"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">読み込み中...</div></div>}>
      <RegisterContent />
    </Suspense>
  );
}
