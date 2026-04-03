import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Fortune YT Tool - Competitive Research & Script Creator",
  description: "Fortune-telling & spiritual YouTube competitive research and script creation tool",
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
