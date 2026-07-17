// サーバー起動時に一度だけ呼ばれる（Next.js instrumentation規約）
// Threadsツールのスクレイパースケジューラを起動する
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { startThreadsScheduler } = await import("@/lib/threads-scheduler");
    startThreadsScheduler();
  }
}
