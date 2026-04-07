"use client";

import LaunchGenerator from "@/components/LaunchGenerator";

const BUTTONS = [
  { type: "letter", label: "セールスレター生成", desc: "3,000〜5,000字 / スクリーニング→共感→オファー" },
];

export default function LaunchLetterPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">セールスレター</h1>
        <p className="text-sm text-gray-500 mt-1">LINE登録者に配信するセールスレターを生成</p>
      </div>
      <LaunchGenerator buttons={BUTTONS} />
    </div>
  );
}
