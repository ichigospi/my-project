import ThreadsHeader from "@/components/ThreadsHeader";

export default function ThreadsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <ThreadsHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}
