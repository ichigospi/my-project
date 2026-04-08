"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import LaunchSidebar from "./LaunchSidebar";
import { pullSharedSettings } from "@/lib/shared-sync";

const NO_SIDEBAR_PATHS = ["/login", "/setup", "/register"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const synced = useRef(false);

  // ログイン後、初回のみサーバーから共有設定を取得
  useEffect(() => {
    if (session && !synced.current) {
      synced.current = true;
      pullSharedSettings();
    }
  }, [session]);

  const hideSidebar = NO_SIDEBAR_PATHS.some((p) => pathname.startsWith(p)) || !session;
  const isLaunch = pathname.startsWith("/launch");

  if (hideSidebar) {
    return <main className="flex-1 overflow-auto">{children}</main>;
  }

  return (
    <>
      {isLaunch ? <LaunchSidebar /> : <Sidebar />}
      <main className="flex-1 overflow-auto">{children}</main>
    </>
  );
}
