import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "売上管理",
  description: "売上・支出の記録と残高管理",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "売上管理",
  },
};

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
