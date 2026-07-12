import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import AuthGuard from "@/components/AuthGuard";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#8b5cf6",
};

export const metadata: Metadata = {
  title: "占いビジネス管理",
  description: "KPI管理とボトルネック特定のためのダッシュボード",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-screen">
        <SessionProvider>
          <AuthGuard>{children}</AuthGuard>
        </SessionProvider>
      </body>
    </html>
  );
}
