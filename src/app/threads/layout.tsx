import type { Metadata, Viewport } from "next";
import ThreadsHeader from "@/components/ThreadsHeader";
import ThreadsMobileNav from "@/components/ThreadsMobileNav";
import KoyomiNotice from "@/components/KoyomiNotice";

// スマホのホーム画面に追加したとき、Threadsツールとして単独起動させる（/threadsを開く）
export const metadata: Metadata = {
  title: "Threads投稿自動作成ツール",
  description: "競合分析 × オマージュ作成 × 反応計測",
  manifest: "/threads-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Threads作成",
  },
  icons: { apple: "/threads-icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function ThreadsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Threads公式アプリ風のダークUI（YTツールとは独立したフルスクリーン画面）
    <div className="relative flex flex-col min-h-screen bg-black text-neutral-100" style={{ colorScheme: "dark" }}>
      {/* 背景の質感: 上部にほのかなグラデーショングロー */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(60rem 24rem at 15% -6rem, rgba(99,102,241,0.10), transparent 60%), radial-gradient(50rem 22rem at 90% -8rem, rgba(217,70,239,0.08), transparent 60%)",
        }}
      />
      <div className="relative z-10 flex flex-col min-h-screen">
        <ThreadsHeader />
        <KoyomiNotice />
        {/* スマホは下部タブバーぶんの余白を確保 */}
        <div className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
      </div>
      {/* スマホ用の下部タブバー（PC非表示） */}
      <ThreadsMobileNav />
    </div>
  );
}
