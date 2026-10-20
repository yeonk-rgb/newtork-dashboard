// 권한 규칙 — 모든 권한 확인은 이 함수를 거친다. 실제 정책이 확정되면 이 파일의 규칙만 바꾼다.
// 사용자 모델 교체(역할 4개) 후 임시 매핑: 경영지원팀 = 이전 "경영지원 팀장"과 같은 권한.
// 새 권한 규칙(경영지원팀 = 모든 팀 수정)은 다음 단계에서 이 파일만 바꾼다.
import type { Action, AppUser, Team } from "./types";

export function can(user: AppUser, action: Action, team: Team): boolean {
  if (!user.active) return false;

  switch (user.role) {
    case "ADMIN":
      return true;
    case "MANAGEMENT":
      // 모든 팀 열람, 입력·확정은 경영지원만
      return action === "view" || team === "management";
    case "LEADER":
      if (team === "management" || !user.viewTeams.includes(team)) {
        return false;
      }
      return action === "view" || user.editTeams.includes(team);
    case "MEMBER":
      if (team === "management") return false;
      return action === "view" && user.viewTeams.includes(team);
  }
}

/** 관리자 설정(직원 권한 변경·비밀번호 초기화·계정 추가·비활성화) */
export function canManageUsers(user: AppUser): boolean {
  return user.active && user.role === "ADMIN";
}
