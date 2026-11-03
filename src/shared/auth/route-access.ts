// 경로별 접근 규칙 (순수 함수 — proxy.ts 가 사용, 판단은 can()/canManageUsers()에 맡긴다)
import { homePathFor, NO_ACCESS_PATH } from "./access";
import { can, canManageUsers } from "./can";
import type { AppUser, Team } from "./types";

export type RouteAccess =
  { type: "allow" } | { type: "redirect"; to: string } | { type: "forbidden" };

const TEAM_PREFIXES: [string, Team][] = [
  ["/management", "management"],
  ["/api/management", "management"],
  ["/production", "production"],
  ["/service", "service"],
  ["/api/service", "service"],
];

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export function routeAccess(user: AppUser, pathname: string): RouteAccess {
  // 메인(전사 요약)은 경영지원 열람 권한 — 없으면 자기 팀 페이지로
  if (pathname === "/") {
    if (can(user, "view", "management")) return { type: "allow" };
    const home = homePathFor(user);
    return home === NO_ACCESS_PATH
      ? { type: "forbidden" }
      : { type: "redirect", to: home };
  }
  if (matches(pathname, "/admin")) {
    return canManageUsers(user) ? { type: "allow" } : { type: "forbidden" };
  }
  for (const [prefix, team] of TEAM_PREFIXES) {
    if (matches(pathname, prefix)) {
      return can(user, "view", team)
        ? { type: "allow" }
        : { type: "forbidden" };
    }
  }
  return { type: "allow" };
}
