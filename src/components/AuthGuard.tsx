"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PUBLIC_PATHS = ["/login", "/setup", "/register", "/sales"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    // ローカル環境では認証チェックをスキップ
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      setChecking(false);
      return;
    }

    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

    if (!session && !isPublic) {
      // セットアップが必要か確認
      fetch("/api/setup")
        .then((r) => r.json())
        .then((data) => {
          if (data.needsSetup) {
            router.replace("/setup");
          } else {
            router.replace("/login");
          }
        })
        .catch(() => router.replace("/login"));
      return;
    }

    setChecking(false);
  }, [session, status, pathname, router]);

  if (status === "loading" || checking) {
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    if (isPublic) return <>{children}</>;
    // ローカル環境では読み込み画面をスキップ
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      return <>{children}</>;
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return <>{children}</>;
}
