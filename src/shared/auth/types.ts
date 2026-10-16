// 권한 관련 공통 타입. 실제 로그인으로 교체해도 그대로 쓴다.

export type Team = "management" | "production" | "service";

/** ADMIN·CEO는 팀 소속 없음, 나머지는 MEMBER(팀장 여부는 isLeader) */
export type Role = "ADMIN" | "CEO" | "MEMBER";

/**
 * - view: 열람
 * - edit: 데이터 입력·임시저장
 * - confirm: 확정, 확정된 데이터 수정, 지출 항목·목표 같은 설정 변경
 */
export type Action = "view" | "edit" | "confirm";

export type AppUser = {
  id: string;
  name: string;
  role: Role;
  team: Team | null;
  isLeader: boolean;
};

export const TEAM_LABEL: Record<Team, string> = {
  management: "경영지원",
  production: "생산",
  service: "서비스",
};

export function roleLabel(user: AppUser): string {
  if (user.role === "ADMIN") return "관리자";
  if (user.role === "CEO") return "대표";
  const team = user.team ? TEAM_LABEL[user.team] : "";
  return `${team} ${user.isLeader ? "팀장" : "팀원"}`;
}
