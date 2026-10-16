// 화면 접근 규칙 (메뉴, 이동할 페이지). 판단은 모두 can()에 맡긴다.
import { can } from "./can";
import type { AppUser, Team } from "./types";

export type NavItem = { href: string; label: string };

type NavRule = NavItem & ({ team: Team } | { adminOnly: true });

const NAV_RULES: NavRule[] = [
  // 메인(전사 요약)은 경영지원팀 열람 권한과 같다
  { href: "/", label: "메인", team: "management" },
  { href: "/management", label: "경영지원", team: "management" },
  { href: "/production", label: "생산", team: "production" },
  { href: "/service", label: "서비스", team: "service" },
  { href: "/admin", label: "관리자", adminOnly: true },
];

export function canAccessAdmin(user: AppUser): boolean {
  return user.role === "ADMIN";
}

/** 사이드바·403 화면에 보여줄, 이 사용자가 열 수 있는 페이지 */
export function accessiblePages(user: AppUser): NavItem[] {
  return NAV_RULES.filter((rule) =>
    "adminOnly" in rule ? canAccessAdmin(user) : can(user, "view", rule.team),
  ).map(({ href, label }) => ({ href, label }));
}

/** 메인에 접근할 수 없을 때 이동할 자기 팀 페이지 */
export function homePathFor(user: AppUser): string {
  if (can(user, "view", "management")) return "/";
  if (user.team) return `/${user.team}`;
  return accessiblePages(user)[0]?.href ?? "/";
}
