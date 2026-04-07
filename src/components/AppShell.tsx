"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Sidebar from "./Sidebar";
import LaunchSidebar from "./LaunchSidebar";

const NO_SIDEBAR_PATHS = ["/login", "/setup", "/register"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

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
