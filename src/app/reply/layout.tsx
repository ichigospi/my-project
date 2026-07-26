import ReplyHeader from "@/components/ReplyHeader";

export default function ReplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <ReplyHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}
