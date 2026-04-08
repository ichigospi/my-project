"use client";

import LaunchGenerator from "@/components/LaunchGenerator";

const BUTTONS = [
  { type: "columns", label: "コラム3本生成", desc: "問題→解決策→自分ごと化の連鎖構造 + 企画投稿付き" },
];

export default function LaunchColumnsPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">コラム生成</h1>
        <p className="text-sm text-gray-500 mt-1">3本連鎖コラム（Day 4, 8, 10配布）を一括生成</p>
      </div>
      <LaunchGenerator buttons={BUTTONS} />
    </div>
  );
}
