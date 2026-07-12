"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

const PUBLIC_PATHS = ["/login", "/setup"];

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

// 画面の出し分けはせず、未認証ならリダイレクトするだけにする
// （SSRとクライアントの初回レンダーを一致させるため。データ自体はAPI側で保護済み）
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "loading") return;
    if (isLocalhost()) return;

    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    if (!session && !isPublic) {
      fetch("/api/setup")
        .then((r) => r.json())
        .then((data) => {
          router.replace(data.needsSetup ? "/setup" : "/login");
        })
        .catch(() => router.replace("/login"));
    }
  }, [session, status, pathname, router]);

  return <>{children}</>;
}
