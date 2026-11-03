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

/** 하위 메뉴: 묶음과 같은 주소(각 팀 대시보드 "/management"·"/production")는 정확히 일치, 나머지는 하위 경로 포함 */
function isSubActive(pathname: string, href: string, groupHref: string) {
  return href === groupHref
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
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

  const linkClass = (active: boolean, sub = false) =>
    cn(
      "flex h-10 items-center gap-3 rounded-xl text-sm transition-colors duration-150",
      sub ? "pr-3 pl-10" : "px-3",
      // 현재 메뉴 = 진한 pill (docs/design-guide.md)
      active
        ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
        : "hover:bg-primary-50 hover:text-sidebar-accent-foreground",
    );

  return (
    <nav aria-label="주 메뉴" className="flex flex-col gap-1 px-3 py-4">
      {items.map(({ href, label, children }) => {
        const Icon = ICONS[href] ?? LayoutDashboard;
        if (children && children.length > 0) {
          // 하위 메뉴가 있으면 상위는 묶음 제목 (하위 중 하나가 활성이면 굵게)
          const groupActive = children.some((c) =>
            isSubActive(pathname, c.href, href),
          );
          return (
            <div key={href}>
              <Link
                href={withPeriod(href, period)}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-150 hover:bg-primary-50 hover:text-sidebar-accent-foreground",
                  groupActive && "font-semibold text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                {label}
              </Link>
              <ul className="mt-1 space-y-1">
                {children.map((child) => {
                  const active = isSubActive(pathname, child.href, href);
                  return (
                    <li key={child.href}>
                      <Link
                        href={withPeriod(child.href, period)}
                        aria-current={active ? "page" : undefined}
                        className={linkClass(active, true)}
                      >
                        {child.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={withPeriod(href, period)}
            aria-current={active ? "page" : undefined}
            className={linkClass(active)}
          >
            <Icon
              className={cn("size-4", !active && "text-muted-foreground")}
              aria-hidden
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
