import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "占いスピマーケティングツール",
  description: "占い・スピリチュアル業界向け LINE × UTAGE マーケティング自動化ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-screen flex">
        <SessionProvider>
          <AuthGuard>
            <AppShell>{children}</AppShell>
          </AuthGuard>
        </SessionProvider>
      </body>
    </html>
  );
}
