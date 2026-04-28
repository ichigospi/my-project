"use client";

import Link from "next/link";
import { useXPostGenre, X_POST_GENRES } from "@/lib/x-post-genre";

const quickActions = [
  { href: "/x-post/create", label: "新規ポスト生成", emoji: "✏️", color: "bg-indigo-500 hover:bg-indigo-600" },
  { href: "/x-post/competitors", label: "競合追加・収集", emoji: "👥", color: "bg-emerald-500 hover:bg-emerald-600" },
  { href: "/x-post/analysis", label: "分析実行", emoji: "🔍", color: "bg-amber-500 hover:bg-amber-600" },
  { href: "/x-post/daily", label: "今日のプラン", emoji: "📅", color: "bg-rose-500 hover:bg-rose-600" },
];

const featureNav = [
  { href: "/x-post/knowledge", title: "📚 ナレッジ", desc: "自アカ情報・教材・参考ポスト・テンプレを管理" },
  { href: "/x-post/competitors", title: "👥 競合", desc: "競合アカウント登録 + 伸びてるポスト収集" },
  { href: "/x-post/analysis", title: "🔍 分析", desc: "収集ポストから構成・フック・強化要素を抽出" },
  { href: "/x-post/templates", title: "📋 テンプレ", desc: "単一ポスト + シーケンスパターンの管理" },
  { href: "/x-post/create", title: "✏️ 生成", desc: "ゼロから / テンプレから / デイリーから生成" },
  { href: "/x-post/daily", title: "📅 デイリープラン", desc: "今日の5ポスト計画と教育バランス" },
];

export default function XPostDashboardPage() {
  const [genre] = useXPostGenre();
  const genreLabel = X_POST_GENRES.find((g) => g.value === genre)?.label ?? "";

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          ダッシュボード <span className="text-base font-normal text-gray-500">（{genreLabel}）</span>
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Xポスト作成ツールへようこそ。ジャンルを切り替えてビジ系/占い系それぞれの設定で運用できます。
        </p>
      </div>

      {/* 統計カード（Phase 2以降で実データ接続） */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-2">統計</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "ナレッジ", value: "—", emoji: "📚" },
            { label: "競合", value: "—", emoji: "👥" },
            { label: "収集ポスト", value: "—", emoji: "📥" },
            { label: "分析", value: "—", emoji: "🔍" },
            { label: "生成済", value: "—", emoji: "✏️" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                <span>{s.emoji}</span>
                {s.label}
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* クイックアクション */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-2">クイックアクション</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`${a.color} text-white rounded-lg px-4 py-3 flex items-center gap-2 font-medium transition-colors`}
            >
              <span className="text-lg">{a.emoji}</span>
              <span className="text-sm">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 機能ナビ */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-2">機能</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {featureNav.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-400 hover:shadow-sm transition"
            >
              <div className="font-bold text-gray-900">{f.title}</div>
              <div className="text-sm text-gray-600 mt-1">{f.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Phase状況の説明 */}
      <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="text-sm font-bold text-amber-900">🚧 開発状況</div>
        <p className="text-xs text-amber-800 mt-1">
          Phase 1（基盤）実装中。各機能ページはスケルトン表示で、Phase 2以降で機能実装します。
        </p>
      </section>
    </main>
  );
}
