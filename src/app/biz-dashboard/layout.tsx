import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "占いビジネス管理",
  description: "売上・リスト・鑑定実績のダッシュボード",
};

export default function BizDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
