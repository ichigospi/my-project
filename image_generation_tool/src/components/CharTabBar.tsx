"use client";

// 複数キャラ選択時の「誰の服装/表情を今編集するか」を切り替えるタブ。
// 格好カードと表情カードで共通に使う。

import { clsx } from "./clsx";
import type { CharacterLite } from "@/lib/prompt-builder";

interface Props {
  chars: CharacterLite[];
  activeSlot: string;
  onSelect: (slot: string) => void;
}

export default function CharTabBar({ chars, activeSlot, onSelect }: Props) {
  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {chars.map((c, idx) => {
        const active = activeSlot === c.id;
        const roleLabel = idx === 0 ? "主体" : `相手${idx}`;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={clsx(
              "rounded-md px-2.5 py-1 text-[11px] transition",
              active ? "bg-indigo-500 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700",
            )}
            title={roleLabel}
          >
            <span className="mr-1 text-[10px] opacity-70">
              {c.gender === "female" ? "♀" : c.gender === "male" ? "♂" : "・"}
            </span>
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
