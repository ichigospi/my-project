// 文字列配列の編集UI（追加・削除可能）
"use client";

import { useState } from "react";

interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  buttonLabel?: string;
}

export default function ArrayInput({ values, onChange, placeholder, buttonLabel = "追加" }: Props) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...values, v]);
    setDraft("");
  };
  const remove = (i: number) => {
    onChange(values.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-indigo-500 hover:text-indigo-700"
              aria-label="削除"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition-colors"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
