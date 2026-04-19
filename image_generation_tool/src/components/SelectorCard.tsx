"use client";

// 6W1H のカード1個の器。アイコン + ラベル + 現在の選択表示 + 子要素。

import { type ReactNode } from "react";

interface Props {
  icon: string;
  title: string;
  summary?: string;
  help?: string;
  children: ReactNode;
}

export default function SelectorCard({ icon, title, summary, help, children }: Props) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/60 p-3">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold text-gray-200">
          <span className="mr-1.5">{icon}</span>
          {title}
        </h2>
        {summary ? (
          <span className="truncate text-xs text-indigo-300" title={summary}>
            {summary}
          </span>
        ) : null}
      </header>
      <div>{children}</div>
      {help ? <p className="text-[10px] text-gray-500">{help}</p> : null}
    </section>
  );
}
