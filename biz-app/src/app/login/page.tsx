"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("メールアドレスまたはパスワードが違います");
    } else {
      router.replace("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#ab87f5] to-[#8558ee] p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 space-y-4">
        <h1 className="text-xl font-bold text-gray-900 text-center">占いビジネス管理</h1>
        <p className="text-sm text-gray-500 text-center">ログイン</p>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
        <input
          type="email"
          required
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400"
        />
        <input
          type="password"
          required
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </form>
    </div>
  );
}
