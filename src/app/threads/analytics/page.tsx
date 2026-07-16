"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useThreadsAccountId } from "@/lib/threads-account";
import { api, fmtDate, fmtNum } from "@/lib/threads-client";

interface PostRow {
  id: string;
  content: string;
  publishedAt: string | null;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
}

interface Analytics {
  publishedCount: number;
  totals: { views: number; likes: number; replies: number; reposts: number };
  averages: { views: number; likes: number; replies: number; reposts: number };
  planTypes: { planType: string; count: number; avgViews: number; avgLikes: number; avgReplies: number }[];
  topPosts: PostRow[];
  recent: PostRow[];
}

export default function ThreadsAnalyticsPage() {
  const [accountId] = useThreadsAccountId();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"top" | "recent">("top");

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      setData(await api<Analytics>(`/api/threads/analytics?accountId=${accountId}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = data
    ? [
        { label: "投稿数", value: String(data.publishedCount) },
        { label: "平均表示", value: fmtNum(data.averages.views) },
        { label: "平均いいね", value: fmtNum(data.averages.likes) },
        { label: "平均コメント", value: fmtNum(data.averages.replies) },
        { label: "合計表示", value: fmtNum(data.totals.views) },
        { label: "合計いいね", value: fmtNum(data.totals.likes) },
      ]
    : [];

  const rows = data ? (tab === "top" ? data.topPosts : data.recent) : [];

  return (
    <main className="px-4 md:px-6 py-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-neutral-100">アナリティクス</h2>
        <p className="text-sm text-neutral-400 mt-1">
          投稿済みの実績を集計します（実績は投稿管理で入力。Phase 2でスクレイパー自動化予定）。
        </p>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-sm text-rose-300">{error}</div>}

      {data && data.publishedCount === 0 ? (
        <div className="bg-neutral-900 rounded-xl border border-dashed border-neutral-700 p-10 text-center text-sm text-neutral-500">
          まだ投稿済みのデータがありません。
          <Link href="/threads/posts" className="text-sky-400 underline ml-1">投稿管理</Link>
          で「投稿済みにする」+ 実績入力をすると、ここに集計が表示されます。
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
                <div className="text-xs text-neutral-500">{c.label}</div>
                <div className="text-2xl font-bold text-neutral-100 mt-1">{c.value}</div>
              </div>
            ))}
          </div>

          {data && data.planTypes.length > 0 && (
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
              <h3 className="text-sm font-bold text-neutral-100 mb-3">企画タイプ × 成績（オマージュ元の分類ベース・平均いいね順）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[480px]">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500">
                      <th className="text-left px-2 py-2 font-medium">企画タイプ</th>
                      <th className="text-right px-2 py-2 font-medium">投稿数</th>
                      <th className="text-right px-2 py-2 font-medium">平均表示</th>
                      <th className="text-right px-2 py-2 font-medium">平均いいね</th>
                      <th className="text-right px-2 py-2 font-medium">平均コメント</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.planTypes.map((p) => (
                      <tr key={p.planType} className="border-b border-neutral-800/60">
                        <td className="px-2 py-2">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">{p.planType}</span>
                        </td>
                        <td className="px-2 py-2 text-right text-neutral-300">{p.count}</td>
                        <td className="px-2 py-2 text-right text-neutral-300">{fmtNum(p.avgViews)}</td>
                        <td className="px-2 py-2 text-right text-neutral-100 font-bold">{fmtNum(p.avgLikes)}</td>
                        <td className="px-2 py-2 text-right text-neutral-300">{fmtNum(p.avgReplies)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-neutral-500 mt-2">→ 平均いいねが高い企画タイプを、リサーチ画面のフィルタで深掘りして次のオマージュ元に。</p>
            </div>
          )}

          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-neutral-100">投稿別実績</h3>
              <div className="inline-flex rounded-lg bg-neutral-800 p-0.5 ml-2">
                {([
                  ["top", "いいね順"],
                  ["recent", "新しい順"],
                ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setTab(v)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md ${tab === v ? "bg-neutral-900 text-neutral-100 shadow" : "text-neutral-400 hover:text-white"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-500">
                    <th className="text-left px-2 py-2 font-medium w-[45%]">投稿</th>
                    <th className="text-left px-2 py-2 font-medium">投稿日時</th>
                    <th className="text-right px-2 py-2 font-medium">表示</th>
                    <th className="text-right px-2 py-2 font-medium">❤️</th>
                    <th className="text-right px-2 py-2 font-medium">💬</th>
                    <th className="text-right px-2 py-2 font-medium">🔁</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b border-neutral-800/60 hover:bg-neutral-800/60">
                      <td className="px-2 py-2 text-neutral-200">
                        <Link href={`/threads/posts?draftId=${p.id}`} className="line-clamp-1 hover:text-sky-400">
                          {p.content || "（本文なし）"}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-neutral-500 whitespace-nowrap">{fmtDate(p.publishedAt)}</td>
                      <td className="px-2 py-2 text-right text-neutral-300">{fmtNum(p.views)}</td>
                      <td className="px-2 py-2 text-right text-neutral-100 font-bold">{fmtNum(p.likes)}</td>
                      <td className="px-2 py-2 text-right text-neutral-300">{fmtNum(p.replies)}</td>
                      <td className="px-2 py-2 text-right text-neutral-300">{fmtNum(p.reposts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
