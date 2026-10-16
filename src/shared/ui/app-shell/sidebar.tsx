"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

function isActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/** 메뉴 목록은 서버(SidebarNav)에서 권한별로 걸러서 넘긴다. 숨김은 보조 수단 — 실제 차단은 각 페이지에서 */
export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="주 메뉴" className="flex flex-col gap-1 p-3">
      {items.map(({ href, label }) => {
        const Icon = ICONS[href] ?? LayoutDashboard;
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
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
