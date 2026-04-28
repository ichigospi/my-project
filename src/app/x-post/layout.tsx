import XPostHeader from "@/components/XPostHeader";

export default function XPostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <XPostHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}
