"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTasks, getMyChannel } from "@/lib/project-store";
import type { ProductionTask, MyChannelData } from "@/lib/project-store";
import { getChannels } from "@/lib/channel-store";
import type { RegisteredChannel } from "@/lib/channel-store";
import { formatNumber } from "@/lib/mock-data";

// ===== 工程名定数 =====
const PIPELINE_STEPS = [
  { key: "企画出し", label: "企画出し" },
  { key: "台本作成", label: "台本作成" },
  { key: "動画編集", label: "動画編集" },
  { key: "サムネ作成", label: "サムネ" },
  { key: "アップロード", label: "アップロード" },
];

// ===== セクション1: 制作パイプライン =====
function PipelineSection({ tasks }: { tasks: ProductionTask[] }) {
  // サマリーカウント
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

  // パイプライン各工程の未完了タスク数
  const stepCounts: Record<string, number> = {};
  for (const step of PIPELINE_STEPS) {
    stepCounts[step.key] = tasks.filter((task) => {
      const s = task.steps.find((st) => st.name === step.key);
      return s && s.status !== "completed";
    }).length;
  }

  // 期限3日以内アラート
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
      <h2 className="text-lg font-semibold text-foreground mb-4">
        制作パイプライン
      </h2>

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
          <div key={step.key} className="flex items-center gap-1">
            <div className="bg-sidebar-bg/10 border border-gray-200 rounded-lg px-3 py-2 text-center min-w-[72px]">
              <p className="text-xs text-gray-500 leading-tight">{step.label}</p>
              <p className="text-lg font-bold text-foreground">
                {stepCounts[step.key]}
              </p>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <span className="text-gray-400 font-semibold text-sm">→</span>
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
              <span className="text-warning shrink-0">⚠</span>
              <span className="text-sm text-yellow-800 flex-1">
                <strong>{t.title}</strong> — 期限{" "}
                {new Date(t.deadline).toLocaleDateString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                })}
                まで
              </span>
              <span className="text-xs text-yellow-600 shrink-0">
                → 工程表
              </span>
            </Link>
          ))}
          {reviewAlerts.map((t) => (
            <Link
              key={`rv-${t.id}`}
              href="/workflow"
              className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <span className="shrink-0">✋</span>
              <span className="text-sm text-blue-800 flex-1">
                <strong>{t.title}</strong> — 検収待ち
              </span>
              <span className="text-xs text-blue-600 shrink-0">→ 工程表</span>
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
        <h2 className="text-lg font-semibold text-foreground mb-4">
          自チャンネルKPI
        </h2>
        <p className="text-sm text-gray-400 text-center py-4">読み込み中...</p>
      </section>
    );
  }

  if (!myChannel) {
    return (
      <section className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          自チャンネルKPI
        </h2>
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 mb-3">
            チャンネルが登録されていません。
          </p>
          <Link href="/performance" className="text-sm text-accent hover:underline">
            パフォーマンスページでチャンネルを登録 →
          </Link>
        </div>
      </section>
    );
  }

  // 全スナップショットから集計
  const allSnapshots = myChannel.videos.flatMap((v) => v.snapshots);
  const totalViews = allSnapshots.reduce((sum, s) => sum + s.views, 0);
  const avgViews =
    myChannel.videos.length > 0
      ? Math.round(totalViews / myChannel.videos.length)
      : 0;

  // 登録者転換率: 総いいね数 / 総再生数
  const totalLikes = allSnapshots.reduce((sum, s) => sum + s.likes, 0);
  const conversionRate =
    totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(2) : "0.00";

  // 最高再生数動画
  const topVideo = myChannel.videos.reduce<MyChannelData["videos"][0] | null>(
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
      <h2 className="text-lg font-semibold text-foreground mb-1">
        自チャンネルKPI
      </h2>
      <p className="text-sm text-gray-400 mb-4">{myChannel.channelName}</p>

      {/* KPIグリッド */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-sidebar-bg/5 border border-gray-100 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">平均再生数</p>
          <p className="text-2xl font-bold text-foreground">
            {formatNumber(avgViews)}
          </p>
        </div>
        <div className="bg-sidebar-bg/5 border border-gray-100 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">登録者転換率（いいね率）</p>
          <p className="text-2xl font-bold text-foreground">
            {conversionRate}%
          </p>
        </div>
      </div>

      {/* トップ動画 */}
      {topVideo && (
        <div className="border border-gray-100 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-2">トップ動画</p>
          <p className="text-sm font-semibold text-foreground line-clamp-2 mb-3">
            {topVideo.title}
          </p>
          <div className="flex gap-4 text-xs text-gray-500 mb-3">
            <span>
              再生数:{" "}
              <strong className="text-foreground">
                {formatNumber(topVideoViews)}
              </strong>
            </span>
            <span>
              エンゲージメント:{" "}
              <strong className="text-foreground">{topVideoEngagement}%</strong>
            </span>
          </div>
          <Link
            href="/performance"
            className="inline-flex items-center text-sm text-accent hover:underline font-medium"
          >
            パフォーマンス詳細 →
          </Link>
        </div>
      )}
    </section>
  );
}

// ===== セクション3: 競合の注目動画 =====
function CompetitorSection({ channels }: { channels: RegisteredChannel[] }) {
  const router = useRouter();

  // 登録チャンネルの中でデータがあるもの
  const channelsWithData = channels.filter((ch) => ch.subscribers != null && ch.name);

  // 平均登録者数を計算して、登録者の割に再生数が多いチャンネルの動画を注目動画とする
  // ここでは登録者数の多い上位チャンネルを表示し、動画検索への導線を出す
  const topChannels = channelsWithData
    .sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0))
    .slice(0, 5);

  return (
    <section className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">競合チャンネル概況</h2>
        <div className="flex gap-3">
          <Link href="/search" className="text-sm text-accent hover:underline">伸びてる動画を検索 →</Link>
          <Link href="/channel" className="text-sm text-gray-500 hover:underline">全チャンネル →</Link>
        </div>
      </div>

      {topChannels.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 mb-2">競合チャンネルのデータがありません。</p>
          <Link href="/channel" className="text-sm text-accent hover:underline">チャンネル分析でデータを取得 →</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {topChannels.map((ch) => (
            <div key={ch.url} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
              {ch.thumbnailUrl ? (
                <img src={ch.thumbnailUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-xs shrink-0">
                  {(ch.name || "?").charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ch.name}</p>
                <p className="text-xs text-gray-500">{formatNumber(ch.subscribers || 0)}人 · {ch.videoCount || 0}本</p>
              </div>
              <button onClick={() => router.push("/search")}
                className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 shrink-0">
                動画を検索
              </button>
            </div>
          ))}
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
    colorClass: "bg-purple-50 text-purple-600 hover:bg-purple-100",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
        />
      </svg>
    ),
  },
  {
    label: "競合動画を検索",
    href: "/search",
    colorClass: "bg-blue-50 text-blue-600 hover:bg-blue-100",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
        />
      </svg>
    ),
  },
  {
    label: "台本を分析",
    href: "/analysis",
    colorClass: "bg-green-50 text-green-600 hover:bg-green-100",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
  },
  {
    label: "パフォーマンスを確認",
    href: "/performance",
    colorClass: "bg-orange-50 text-orange-600 hover:bg-orange-100",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
];

function QuickActionsSection() {
  return (
    <section className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        クイックアクション
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`flex flex-col items-center gap-2 p-5 rounded-xl transition-colors ${action.colorClass}`}
          >
            {action.icon}
            <span className="text-sm font-medium text-center leading-tight">
              {action.label}
            </span>
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
        <p className="text-sm text-gray-500 mt-1">
          占い・スピリチュアル系YouTube管理ツール
        </p>
      </div>

      {/* セクション1: 制作パイプライン */}
      <PipelineSection tasks={tasks} />

      {/* セクション2 & 3: 2カラム */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* セクション2: 自チャンネルKPI */}
        <MyChannelSection />

        {/* セクション3: 競合の注目動画 */}
        <CompetitorSection channels={channels} />
      </div>

      {/* セクション4: クイックアクション */}
      <QuickActionsSection />
    </div>
  );
}
