import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "占いスピYTツール",
  description: "競合リサーチ & 台本作成",
  manifest: "/manifest.json",
  themeColor: "#6366f1",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "占いスピYT",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className="min-h-screen flex">
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`,
          }}
        />
        <SessionProvider>
          <AuthGuard>
            <AppShell>{children}</AppShell>
          </AuthGuard>
        </SessionProvider>
      </body>
    </html>
  );
}
