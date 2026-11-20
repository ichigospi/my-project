"use client";

// 本文を読み物として表示し、指定範囲をマーカーで示してそこへスクロールする（品質チェックの「該当箇所を見る」用）
import { useEffect, useRef } from "react";
import type { TextRange } from "@/lib/locate";

export default function HighlightText({ text, range, className }: { text: string; range: TextRange | null; className?: string }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (range && ref.current) ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [range?.start, range?.end]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!range || range.start < 0 || range.end <= range.start || range.end > text.length) {
    return <pre className={`whitespace-pre-wrap font-sans ${className || ""}`}>{text}</pre>;
  }
  return (
    <pre className={`whitespace-pre-wrap font-sans ${className || ""}`}>
      {text.slice(0, range.start)}
      <mark ref={ref} className="bg-yellow-200 text-gray-900 rounded px-0.5 ring-2 ring-amber-400">{text.slice(range.start, range.end)}</mark>
      {text.slice(range.end)}
    </pre>
  );
}
