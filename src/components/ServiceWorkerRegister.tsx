"use client";

import { useEffect } from "react";

// ローカル開発（localhost / 127.0.0.1）では Service Worker を使わない。
// 開発サーバーの再起動・再ビルドで静的ファイルのハッシュが変わるため、
// SWが古いHTMLをキャッシュから返すと CSS/JS が404になり、
// 装飾なしの「読み込み中...」のまま止まる。既存の登録とキャッシュも掃除する。
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (isLocal) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => { /* ignore */ });
      if ("caches" in window) {
        caches.keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => { /* ignore */ });
      }
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => { /* ignore */ });
  }, []);
  return null;
}
