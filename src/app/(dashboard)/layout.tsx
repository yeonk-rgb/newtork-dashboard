import { Header } from "@/shared/ui/app-shell/header";
import { SidebarNav } from "@/shared/ui/app-shell/sidebar-nav";

// 공통 셸: 상단 헤더 + 좌측 사이드바 + 밝은 회색 바탕(canvas) 위 흰 카드 (docs/design-guide.md)
// 사용자 정보는 Header·SidebarNav 안쪽 Suspense에서 읽는다 (레이아웃 최상단에서 기다리지 않음)
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <SidebarNav />
        <main className="flex-1 bg-canvas p-6">{children}</main>
      </div>
    </div>
  );
}
