import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "X自動化ツール",
  description: "X（Twitter）の自動分析・投稿生成・自動投稿・記事作成ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
