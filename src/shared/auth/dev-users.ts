// 개발용 임시 사용자 — 실제 로그인으로 교체할 때 삭제한다. (docs/integration-notes.md)
import type { AppUser } from "./types";

export const DEV_USERS = [
  {
    id: "dev-admin",
    name: "관리자(개발)",
    role: "ADMIN",
    team: null,
    isLeader: false,
  },
  {
    id: "dev-ceo",
    name: "대표(개발)",
    role: "CEO",
    team: null,
    isLeader: false,
  },
  {
    id: "dev-mgmt-leader",
    name: "경영지원 팀장(개발)",
    role: "MEMBER",
    team: "management",
    isLeader: true,
  },
  {
    id: "dev-mgmt-member",
    name: "경영지원 팀원(개발)",
    role: "MEMBER",
    team: "management",
    isLeader: false,
  },
  {
    id: "dev-prod-member",
    name: "생산 팀원(개발)",
    role: "MEMBER",
    team: "production",
    isLeader: false,
  },
] as const satisfies readonly AppUser[];

export type DevUserId = (typeof DEV_USERS)[number]["id"];

/** 개발 기본 사용자, DEMO_MODE 고정 사용자 */
export const DEFAULT_DEV_USER_ID: DevUserId = "dev-mgmt-leader";

export function findDevUser(id: string | undefined): AppUser | undefined {
  return DEV_USERS.find((user) => user.id === id);
}

/** 작성자·수정자 id → 화면 표시 이름 (실제 로그인으로 교체할 때 사용자 테이블 조회로 바꾼다) */
export function userDisplayName(id: string | null | undefined): string {
  if (!id) return "-";
  if (id === "seed") return "샘플 데이터";
  return findDevUser(id)?.name ?? id;
}
