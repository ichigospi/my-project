"use client";

// プリセットボタンのグリッド。単一選択 / 複数選択に対応。

import { clsx } from "./clsx";

export interface ChipItem {
  id: string;
  label: string;
  subLabel?: string;
}

interface Props {
  items: ChipItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  emptyHint?: string;
}

export default function PresetChipGroup({ items, selectedIds, onToggle, emptyHint }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-700 px-3 py-4 text-center text-xs text-gray-500">
        {emptyHint ?? "登録なし"}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const active = selectedIds.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            className={clsx(
              "rounded-full px-3 py-1 text-xs transition",
              active
                ? "bg-indigo-500 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700",
            )}
          >
            {item.label}
            {item.subLabel ? <span className="ml-1 text-[10px] opacity-70">{item.subLabel}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
