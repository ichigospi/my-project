"use client";

import LaunchGenerator from "@/components/LaunchGenerator";

const BUTTONS = [
  { type: "posts_phase1", label: "Phase 1 投稿", desc: "Day 1-5 / 教育・興味づけ / 15本" },
  { type: "posts_phase2", label: "Phase 2 投稿", desc: "Day 6-10 / 信頼構築 / 15本" },
  { type: "posts_phase3", label: "Phase 3 投稿", desc: "Day 11-14 / 予告・販売 / 12本+企画3本" },
];

export default function LaunchPostsPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">投稿生成</h1>
        <p className="text-sm text-gray-500 mt-1">14日間×3投稿 = 42本 + コラム企画3本をフェーズ別に生成</p>
      </div>
      <LaunchGenerator buttons={BUTTONS} />
    </div>
  );
}
