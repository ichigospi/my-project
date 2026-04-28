// Xポストツール用のジャンル切替（business/spiritual）
// localStorage で永続化、ページ間で共有
"use client";

import { useSyncExternalStore } from "react";

export type XPostGenre = "business" | "spiritual";

const STORAGE_KEY = "x_post_genre";
const EVENT_NAME = "x-post-genre-changed";
const SERVER_DEFAULT: XPostGenre = "business";

export const X_POST_GENRES: { value: XPostGenre; label: string; emoji: string }[] = [
  { value: "business", label: "ビジネス系", emoji: "💼" },
  { value: "spiritual", label: "占いスピ系", emoji: "🔮" },
];

export function getGenre(): XPostGenre {
  if (typeof window === "undefined") return SERVER_DEFAULT;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "business" || saved === "spiritual") return saved;
  return SERVER_DEFAULT;
}

export function setGenre(genre: XPostGenre) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, genre);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: genre }));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT_NAME, callback);
  // 別タブからの localStorage 変更も拾う
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

// React フック: 現在のジャンルを購読（useSyncExternalStore で SSR セーフ）
export function useXPostGenre(): [XPostGenre, (g: XPostGenre) => void] {
  const genre = useSyncExternalStore(subscribe, getGenre, () => SERVER_DEFAULT);
  return [genre, setGenre];
}
