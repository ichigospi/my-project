"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTasks, getMyChannel } from "@/lib/project-store";
import type { ProductionTask, MyChannelData } from "@/lib/project-store";
import { getChannels } from "@/lib/channel-store";
import type { RegisteredChannel } from "@/lib/channel-store";
import { formatNumber } from "@/lib/mock-data";

// ===== パイプラインの工程名 =====
const PIPELINE_STEPS = ["企画出し", "台本作成", "動画編集", "サムネ作成", "アップロード"];

// ===== セクション1: 制作パイプライン =====
function PipelineSection({ tasks }: { tasks: ProductionTask[] }) {
  const router = useRouter();

  const urgentCount = tasks.filter((t) => t.urgent).length;
  const reviewWaitingCount = tasks.filter((t) =>
    t.steps.some((s) => s.status === "review_waiting")
  ).length;
  const inProgressCount = tasks.filter((t) =>
    t.steps.some((s) => s.status === "in_progress")
  ).length;
  const completedCount = tasks.filter((t) =>
    t.steps.every((s) => s.status === "completed")
  ).length;

  // 各工程の未完了タスク数
  const stepCounts: Record<string, number> = {};
  for (const step of PIPELINE_STEPS) {
    stepCounts[step] = tasks.filter((task) => {
      const s = task.steps.find((st) => st.name === step);
      return s && s.status !== "completed";
    }).length;
  }

  // 期限3日以内のアラート
  const now = new Date();
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const deadlineAlerts = tasks.filter((t) => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    return d >= now && d <= threeDaysLater;
  });

  // 検収待ちアラート
  const reviewAlerts = tasks.filter((t) =>
    t.steps.some((s) => s.status === "review_waiting")
  );

  return (
    <section className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">制作パイプライン</h2>

      {/* サマリー */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-danger">🔥 {urgentCount}</p>
          <p className="text-xs text-gray-500 mt-1">緊急</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-warning">{reviewWaitingCount}</p>
          <p className="text-xs text-gray-500 mt-1">検収待ち</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-blue-600">{inProgressCount}</p>
          <p className="text-xs text-gray-500 mt-1">作業中</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-success">{completedCount}</p>
          <p className="text-xs text-gray-500 mt-1">完了</p>
        </div>
      </div>

      {/* パイプラインフロー */}
      <div className="flex items-center gap-1 flex-wrap mb-6">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-1">
            <div className="bg-sidebar-bg rounded-lg px-3 py-2 text-center min-w-[80px]">
              <p className="text-xs text-gray-500">{step}</p>
              <p className="text-lg font-bold text-foreground">{stepCounts[step]}</p>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <span className="text-gray-400 font-bold">→</span>
            )}
          </div>
        ))}
      </div>

      {/* アラート */}
      {(deadlineAlerts.length > 0 || reviewAlerts.length > 0) && (
        <div className="space-y-2">
          {deadlineAlerts.map((t) => (
            <Link
              key={`dl-${t.id}`}
              href="/workflow"
              className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
            >
              <span className="text-warning">⚠</span>
              <span className="text-sm text-yellow-800 flex-1">
                <strong>{t.title}</strong> — 期限{" "}
                {new Date(t.deadline).toLocaleDateString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                })}
                まで
              </span>
              <span className="text-xs text-yellow-600">→ 工程表</span>
            </Link>
          ))}
          {reviewAlerts.map((t) => (
            <Link
              key={`rv-${t.id}`}
              href="/workflow"
              className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <span>✋</span>
              <span className="text-sm text-blue-800 flex-1">
                <strong>{t.title}</strong> — 検収待ち
              </span>
              <span className="text-xs text-blue-600">→ 工程表</span>
            </Link>
          ))}
        </div>
      )}

      {tasks.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          タスクがありません。工程表からタスクを追加してください。
        </p>
      )}
    </section>
  );
}

// ===== セクション2: 自チャンネルKPI =====
function MyChannelSection() {
  const [myChannel, setMyChannel] = useState<MyChannelData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMyChannel(getMyChannel());
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <section className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">自チャンネルKPI</h2>
        <p className="text-sm text-gray-400 text-center py-4">読み込み中...</p>
      </section>
    );
  }

  if (!myChannel) {
    return (
      <section className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">自チャンネルKPI</h2>
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 mb-3">チャンネルが登録されていません。</p>
          <Link
            href="/performance"
            className="text-sm text-accent hover:underline"
          >
            パフォーマンスページでチャンネルを登録 →
          </Link>
        </div>
      </section>
    );
  }

  // 全動画のスナップショットから平均再生数を計算
  const allSnapshots = myChannel.videos.flatMap((v) => v.snapshots);
  const totalViews = allSnapshots.reduce((sum, s) => sum + s.views, 0);
  const avgViews = allSnapshots.length > 0 ? Math.round(totalViews / myChannel.videos.length) : 0;

  // 登録者転換率: 総コメント / 総再生数 (engagement proxy)
  const totalLikes = allSnapshots.reduce((sum, s) => sum + s.likes, 0);
  const conversionRate =
    totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(2) : "0.00";

  // 最高再生数の動画
  const topVideo = myChannel.videos.reduce<typeof myChannel.videos[0] | null>(
    (best, v) => {
      const views = v.snapshots.reduce((sum, s) => sum + s.views, 0);
      const bestViews = best
        ? best.snapshots.reduce((sum, s) => sum + s.views, 0)
        : -1;
      return views > bestViews ? v : best;
    },
    null
  );

  const topVideoViews = topVideo
    ? topVideo.snapshots.reduce((sum, s) => sum + s.views, 0)
    : 0;
  const topVideoLikes = topVideo
    ? topVideo.snapshots.reduce((sum, s) => sum + s.likes, 0)
    : 0;
  const topVideoEngagement =
    topVideoViews > 0
      ? ((topVideoLikes / topVideoViews) * 100).toFixed(2)
      : "0.00";

  return (
    <section className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">自チャンネルKPI</h2>
      <p className="text-sm text-gray-400 mb-4">{myChannel.channelName}</p>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-sidebar-bg rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">平均再生数</p>
          <p className="text-2xl font-bold text-foreground">{formatNumber(avgViews)}</p>
        </div>
        <div className="bg-sidebar-bg rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">登録者転換率（いいね率）</p>
          <p className="text-2xl font-bold text-foreground">{conversionRate}%</p>
        </div>
      </div>

      {topVideo && (
        <div className="border border-gray-100 rounded-lg p-4 mb-4">
          <p className="text-xs text-gray-500 mb-2">トップ動画</p>
          <p className="text-sm font-semibold text-foreground line-clamp-2 mb-2">
            {topVideo.title}
          </p>
          <div className="flex gap-4 text-xs text-gray-500">
            <span>再生数: <strong className="text-foreground">{formatNumber(topVideoViews)}</strong></span>
            <span>エンゲージメント: <strong className="text-foreground">{topVideoEngagement}%</strong></span>
          </div>
          <Link
            href="/create"
            className="mt-3 inline-flex items-center text-sm text-accent hover:underline font-medium"
          >
            この企画で台本作成 →
          </Link>
        </div>
      )}
    </section>
  );
}

// ===== セクション3: 競合の注目動画 =====
function CompetitorSection({ channels }: { channels: RegisteredChannel[] }) {
  const router = useRouter();
  const channelsWithData = channels.filter((ch) => ch.name || ch.handle || ch.channelId);
  const topChannels = channelsWithData.slice(0, 5);

  return (
    <section className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">競合の注目動画</h2>
        <Link href="/channel" className="text-sm text-accent hover:underline">
          全チャンネル →
        </Link>
      </div>

      {topChannels.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          競合チャンネルが登録されていません。
        </p>
      ) : (
        <div className="space-y-3">
          {topChannels.map((ch) => {
            const displayName =
              ch.name || (ch.handle ? `@${ch.handle}` : ch.channelId || "不明なチャンネル");
            return (
              <div
                key={ch.url}
                className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors"
              >
                {ch.thumbnailUrl ? (
                  <img
                    src={ch.thumbnailUrl}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  {ch.subscribers != null && (
                    <p className="text-xs text-gray-500">
                      登録者: {formatNumber(ch.subscribers)}人
                      {ch.totalViews != null && (
                        <span className="ml-2">総再生: {formatNumber(ch.totalViews)}</span>
                      )}
                    </p>
                  )}
                  {ch.subscribers == null && (
                    <p className="text-xs text-gray-400">データ未取得</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => router.push("/analysis")}
                    className="text-xs px-3 py-1.5 rounded-lg border border-accent text-accent hover:bg-accent/10 transition-colors"
                  >
                    分析する
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/create")}
                    className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
                  >
                    この企画で作る
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ===== セクション4: クイックアクション =====
const QUICK_ACTIONS = [
  {
    label: "新規企画を作成",
    href: "/create",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    colorClass: "bg-purple-50 text-purple-600 hover:bg-purple-100",
  },
  {
    label: "競合動画を検索",
    href: "/search",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
    ),
    colorClass: "bg-blue-50 text-blue-600 hover:bg-blue-100",
  },
  {
    label: "台本を分析",
    href: "/analysis",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    colorClass: "bg-green-50 text-green-600 hover:bg-green-100",
  },
  {
    label: "パフォーマンスを確認",
    href: "/performance",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    colorClass: "bg-orange-50 text-orange-600 hover:bg-orange-100",
  },
];

function QuickActionsSection() {
  return (
    <section className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">クイックアクション</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-colors ${action.colorClass}`}
          >
            {action.icon}
            <span className="text-sm font-medium text-center">{action.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ===== メインページ =====
export default function DashboardPage() {
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [channels, setChannels] = useState<RegisteredChannel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTasks(getTasks());
    setChannels(getChannels());
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
          <p className="text-sm text-gray-400 mt-1">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">占い・スピリチュアル系YouTube管理ツール</p>
      </div>

      {/* Section 1: 制作パイプライン */}
      <PipelineSection tasks={tasks} />

      {/* Section 2 & 3: 2カラム */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 2: 自チャンネルKPI */}
        <MyChannelSection />

        {/* Section 3: 競合の注目動画 */}
        <CompetitorSection channels={channels} />
      </div>

      {/* Section 4: クイックアクション */}
      <QuickActionsSection />
    </div>
  );
}
