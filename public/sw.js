const CACHE_NAME = "yt-tool-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // 旧バージョンのキャッシュを掃除してから制御を引き継ぐ
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return; // GET以外は素通し
  // ネットワーク優先、オフライン時はキャッシュ。どちらも無い場合も必ずResponseを返す
  // （undefinedを返すとブラウザの「This page couldn't load」汎用エラーになるため）
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        if (e.request.mode === "navigate") {
          return new Response(
            "<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width'><body style='font-family:sans-serif;padding:40px;text-align:center'><h2>接続できませんでした</h2><p>サーバーに繋がりませんでした。通信環境を確認して、再読み込みしてください。</p><button onclick='location.reload()' style='padding:10px 24px;font-size:14px'>再読み込み</button></body>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }
        return new Response("", { status: 503 });
      })
  );
});
