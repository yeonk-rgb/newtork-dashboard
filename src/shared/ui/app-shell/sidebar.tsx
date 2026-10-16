"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Calculator,
  Factory,
  LayoutDashboard,
  Settings,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { NavItem } from "@/shared/auth/access";
import { cn } from "@/shared/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/management": Calculator,
  "/production": Factory,
  "/service": Wrench,
  "/admin": Settings,
};

/** 메인 ↔ 경영지원 사이에서는 선택한 기간(?period=)을 이어간다. 다른 팀 메뉴에는 붙이지 않음 */
const KEEP_PERIOD = new Set(["/", "/management"]);

function withPeriod(href: string, period: string | null) {
  return period && KEEP_PERIOD.has(href)
    ? `${href}?period=${encodeURIComponent(period)}`
    : href;
}

function isActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/** 메뉴 목록은 서버(SidebarNav)에서 권한별로 걸러서 넘긴다. 숨김은 보조 수단 — 실제 차단은 각 페이지에서 */
export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // 메인·경영지원 화면에 있을 때만 period 를 이어감 (생산·서비스 화면의 쿼리는 무시)
  const searchParams = useSearchParams();
  const period = KEEP_PERIOD.has(pathname) ? searchParams.get("period") : null;

  return (
    <nav aria-label="주 메뉴" className="flex flex-col gap-1 p-3">
      {items.map(({ href, label }) => {
        const Icon = ICONS[href] ?? LayoutDashboard;
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={withPeriod(href, period)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/60",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
