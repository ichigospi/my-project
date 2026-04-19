import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "画像生成ツール",
  description: "自分専用の画像生成ツール（SDXL / Illustrious / RunPod Serverless）",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
