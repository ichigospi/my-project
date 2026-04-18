import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "通知くん",
  description: "iOSロック画面風の通知プレビュー作成ツール",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "通知くん",
  },
};

export default function NotifLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
