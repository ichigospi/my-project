"use client";

import LaunchGenerator from "@/components/LaunchGenerator";

const BUTTONS = [
  { type: "line", label: "LINE配信11通を生成", desc: "登録〜コラム配布〜セールス〜購入後まで" },
];

export default function LaunchLinePage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">LINE配信</h1>
        <p className="text-sm text-gray-500 mt-1">全11通のLINE配信メッセージを一括生成</p>
      </div>
      <LaunchGenerator buttons={BUTTONS} />
    </div>
  );
}
