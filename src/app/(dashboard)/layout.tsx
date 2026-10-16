import { Header } from "@/shared/ui/app-shell/header";
import { Sidebar } from "@/shared/ui/app-shell/sidebar";

// 공통 셸: 상단 헤더 + 좌측 사이드바 (다우오피스 스타일)
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 bg-muted/30 p-6">{children}</main>
      </div>
    </div>
  );
}
