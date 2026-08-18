import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "収益カレンダー",
  description: "日々の売上をカレンダーに記録して、累計・期間別に集計する",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "収益カレンダー",
  },
};

export default function RevenueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-[#0b1020]">{children}</div>;
}
