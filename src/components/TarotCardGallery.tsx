"use client";

// 台本作成時に「今回引いたカードの実際の絵柄」を確認するためのギャラリー。
// 抽象ロジック・骨組み・台本テキストからカード名（正位置/逆位置）を抽出し、
// ウェイト版（パブリックドメイン）のスキャン画像を表示する。逆位置は上下反転で表示。
import { useMemo, useState } from "react";
import { extractDrawnCards, tarotCardImageUrl, type DrawnCard } from "@/lib/tarot-draw";

export default function TarotCardGallery({ text }: { text: string }) {
  const cards = useMemo(() => extractDrawnCards(text), [text]);
  const [zoom, setZoom] = useState<DrawnCard | null>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(true);

  if (cards.length === 0) return null;

  const renderCard = (c: DrawnCard, size: "thumb" | "zoom") => {
    const url = tarotCardImageUrl(c.name);
    const reversed = c.orientation === "逆位置";
    const cls = size === "thumb" ? "w-20 h-[136px] md:w-24 md:h-[163px]" : "max-h-[70vh] w-auto";
    if (!url || failed[c.name]) {
      return (
        <div className={`${size === "thumb" ? "w-20 h-[136px] md:w-24 md:h-[163px]" : "w-64 h-[436px]"} rounded-lg border-2 border-purple-200 bg-purple-50 flex flex-col items-center justify-center p-2 ${reversed ? "rotate-180" : ""}`}>
          <span className="text-2xl">🂠</span>
          <span className={`text-[10px] text-purple-700 text-center mt-1 ${reversed ? "rotate-180" : ""}`}>{c.name}</span>
        </div>
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${c.name}（${c.orientation}）`}
        loading="lazy"
        onError={() => setFailed((p) => ({ ...p, [c.name]: true }))}
        className={`${cls} rounded-lg border border-gray-200 shadow-sm object-contain bg-white ${reversed ? "rotate-180" : ""}`}
      />
    );
  };

  return (
    <div className="bg-purple-50/60 rounded-xl border border-purple-100 p-3 mb-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-sm font-medium text-purple-800">
        <span>🃏 今回のカードの絵柄（{cards.length}枚・ウェイト版）</span>
        <span className="text-purple-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <>
          <div className="mt-3 flex flex-wrap gap-3">
            {cards.map((c, i) => (
              <button key={`${c.name}-${i}`} onClick={() => setZoom(c)} className="flex flex-col items-center gap-1 group" title="クリックで拡大">
                {renderCard(c, "thumb")}
                <span className="text-[10px] text-gray-600 group-hover:text-purple-700 text-center leading-tight">
                  {c.slot ? `${c.slot}枚目 ` : ""}{c.name}
                  <br />
                  <span className={c.orientation === "逆位置" ? "text-red-500 font-medium" : "text-gray-400"}>{c.orientation}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">クリックで拡大。逆位置は上下反転で表示。台本の絵柄描写が実物と合っているかの確認用</p>
        </>
      )}

      {/* 拡大モーダル */}
      {zoom && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setZoom(null)}>
          <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {renderCard(zoom, "zoom")}
            <p className="text-white text-sm font-medium">
              {zoom.slot ? `${zoom.slot}枚目: ` : ""}{zoom.name}（{zoom.orientation}）
            </p>
            <button onClick={() => setZoom(null)} className="px-4 py-1.5 rounded-lg bg-white/90 text-gray-800 text-xs hover:bg-white">
              ✕ 閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
