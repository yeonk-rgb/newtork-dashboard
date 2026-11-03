// 권한 관련 공통 타입. 모든 팀이 같이 쓴다.

export type Team = "management" | "production" | "service";

/** 열람 범위·수정 권한 체크박스로 고르는 팀 (경영지원·메인은 역할로 정해짐) */
export type ScopeTeam = Exclude<Team, "management">;
export const SCOPE_TEAMS: readonly ScopeTeam[] = ["production", "service"];

/**
 * 열람 범위만 있으면 팀원도 입력·수정·숨김까지 하는 팀 (수정 권한 체크와 무관)
 * 생산: 2026-11-03 사용자 결정 — 생산팀 저장소 규칙(2026-10-18 "생산팀 데이터 접근 권한이 있는 모든 사용자")을 따름
 */
export const VIEWERS_CAN_EDIT: readonly ScopeTeam[] = ["production"];
export const VIEWERS_CAN_EDIT_NOTE =
  "생산은 열람 범위만 있으면 팀원도 입력·수정할 수 있습니다 (생산팀 규칙).";

/**
 * - ADMIN: 관리자(대표) — 모든 팀 + 관리자 설정
 * - MANAGEMENT: 경영지원팀 — 모든 팀 (관리자 설정 제외)
 * - LEADER: 팀장 — 열람 범위의 팀 열람, 수정 권한의 팀 수정
 * - MEMBER: 팀원 — 열람 범위의 팀 열람만
 */
export type Role = "ADMIN" | "MANAGEMENT" | "LEADER" | "MEMBER";
export const ROLES: readonly Role[] = [
  "ADMIN",
  "MANAGEMENT",
  "LEADER",
  "MEMBER",
];

/**
 * - view: 열람
 * - edit: 데이터 입력·임시저장
 * - confirm: 확정, 확정된 데이터 수정, 지출 항목·목표 같은 설정 변경
 */
export type Action = "view" | "edit" | "confirm";

export type AppUser = {
  id: string;
  loginId: string;
  name: string;
  role: Role;
  /** 팀장·팀원만 의미 있음 (관리자·경영지원팀은 빈 배열 = 전체) */
  viewTeams: ScopeTeam[];
  /** 팀장만 의미 있음, viewTeams 의 부분집합 */
  editTeams: ScopeTeam[];
  /** false = 비활성(퇴사) 계정 → 모든 권한 없음 */
  active: boolean;
  /** true = 초기 비밀번호 사용 중 → 비밀번호를 바꾸기 전에는 모든 권한 없음 */
  mustChangePassword: boolean;
};

export const TEAM_LABEL: Record<Team, string> = {
  management: "경영지원",
  production: "생산",
  service: "서비스",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "관리자",
  MANAGEMENT: "경영지원팀",
  LEADER: "팀장",
  MEMBER: "팀원",
};

/** 헤더 등 표시용: "관리자", "경영지원팀", "생산·서비스 팀원" */
export function roleLabel(user: Pick<AppUser, "role" | "viewTeams">): string {
  if (user.role === "ADMIN" || user.role === "MANAGEMENT") {
    return ROLE_LABEL[user.role];
  }
  const teams = SCOPE_TEAMS.filter((t) => user.viewTeams.includes(t))
    .map((t) => TEAM_LABEL[t])
    .join("·");
  return teams ? `${teams} ${ROLE_LABEL[user.role]}` : ROLE_LABEL[user.role];
}
