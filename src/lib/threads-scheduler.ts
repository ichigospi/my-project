// アプリ内蔵スケジューラ（instrumentation.tsのregisterから起動）
// - 競合の自動収集: 20時間おき
// - 自投稿の自動計測: 1時間おき（計測タイミングに達したdraftだけ更新）
// スクレイパーONかつトークン登録済みの場合のみ動く。多重起動はグローバルフラグで防止。
import { prisma } from "@/lib/prisma";
import { collectCompetitorPosts, collectOwnMetrics } from "@/lib/threads-collector";

const COLLECT_INTERVAL_MS = 20 * 3600 * 1000;
const METRICS_INTERVAL_MS = 55 * 60 * 1000;
const TICK_MS = 10 * 60 * 1000; // 10分ごとに起きて必要か判断

const globalFlags = globalThis as unknown as { __threadsSchedulerStarted?: boolean };

async function tick() {
  try {
    const settings = await prisma.threadsToolSettings.findFirst();
    if (!settings?.scraperEnabled || !settings.apifyToken) return;
    const now = Date.now();

    if (!settings.lastMetricsAt || now - settings.lastMetricsAt.getTime() > METRICS_INTERVAL_MS) {
      await prisma.threadsToolSettings.update({ where: { id: settings.id }, data: { lastMetricsAt: new Date() } });
      const m = await collectOwnMetrics();
      if (m.updated > 0 || m.errors.length > 0) {
        console.log(`[threads-scheduler] metrics: updated=${m.updated} errors=${m.errors.join(" / ") || "none"}`);
      }
    }

    if (!settings.lastCollectAt || now - settings.lastCollectAt.getTime() > COLLECT_INTERVAL_MS) {
      await prisma.threadsToolSettings.update({ where: { id: settings.id }, data: { lastCollectAt: new Date() } });
      const c = await collectCompetitorPosts();
      console.log(
        `[threads-scheduler] collect: handles=${c.handles} items=${c.itemsReturned} created=${c.created} classified=${c.classified} errors=${c.errors.join(" / ") || "none"}`,
      );
    }
  } catch (e) {
    console.error("[threads-scheduler] tick failed:", e);
  }
}

export function startThreadsScheduler() {
  if (globalFlags.__threadsSchedulerStarted) return;
  globalFlags.__threadsSchedulerStarted = true;
  console.log("[threads-scheduler] started");
  // 起動直後は3分待ってから初回tick（デプロイ直後の負荷を避ける）
  setTimeout(tick, 3 * 60 * 1000);
  setInterval(tick, TICK_MS);
}
