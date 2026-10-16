import { Suspense } from "react";

import { accessiblePages, getCurrentUser } from "@/shared/auth";

import { Sidebar } from "./sidebar";

/** 좌측 사이드바 틀. 메뉴는 현재 사용자 권한에 따라 요청 시점에 채운다 (Suspense) */
export function SidebarNav() {
  return (
    <aside className="w-40 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:w-52">
      <Suspense fallback={null}>
        <SidebarItems />
      </Suspense>
    </aside>
  );
}

async function SidebarItems() {
  const user = await getCurrentUser();
  return <Sidebar items={user ? accessiblePages(user) : []} />;
}
