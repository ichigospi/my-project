import ThreadsHeader from "@/components/ThreadsHeader";
import KoyomiNotice from "@/components/KoyomiNotice";

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
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
