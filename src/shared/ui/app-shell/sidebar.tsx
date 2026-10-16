"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  Factory,
  LayoutDashboard,
  Settings,
  Wrench,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "메인", icon: LayoutDashboard },
  { href: "/management", label: "경영지원", icon: Calculator },
  { href: "/production", label: "생산", icon: Factory },
  { href: "/service", label: "서비스", icon: Wrench },
  { href: "/admin", label: "관리자", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-40 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:w-52">
      <nav aria-label="주 메뉴" className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
    </aside>
  );
}
