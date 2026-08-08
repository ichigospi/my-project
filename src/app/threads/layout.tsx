import ThreadsHeader from "@/components/ThreadsHeader";
import KoyomiNotice from "@/components/KoyomiNotice";

export default function ThreadsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Threads公式アプリ風のダークUI（YTツールとは独立したフルスクリーン画面）
    <div className="flex flex-col min-h-screen bg-black text-neutral-100" style={{ colorScheme: "dark" }}>
      <ThreadsHeader />
      <KoyomiNotice />
      <div className="flex-1">{children}</div>
    </div>
  );
}
