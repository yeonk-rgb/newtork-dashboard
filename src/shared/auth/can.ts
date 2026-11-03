// 권한 규칙 — 모든 권한 확인은 이 함수를 거친다. 정책이 바뀌면 이 파일의 규칙만 바꾼다.
// 기준: 2026-10-21 내부 결정 → 2026-10-26 자료 기반 확정 (docs/05-open-questions.md 14·15번)
//
//              경영지원·메인        생산 / 서비스
//   관리자       열람·수정·확정       열람·수정·확정
//   경영지원팀   열람·수정·확정       열람·수정·확정
//   팀장         ✕                   열람 범위 → 열람, 수정 권한 → 수정·확정
//   팀원         ✕                   열람 범위 → 열람
//   (예외) 생산   열람 범위가 있으면 팀장·팀원 모두 열람·수정·확정 — VIEWERS_CAN_EDIT (2026-11-03 사용자 결정, 생산팀 규칙)
//
// 비활성 계정, 초기 비밀번호를 아직 안 바꾼 계정은 모든 동작 불가.
import {
  VIEWERS_CAN_EDIT,
  type Action,
  type AppUser,
  type Team,
} from "./types";

export function can(user: AppUser, action: Action, team: Team): boolean {
  if (!user.active || user.mustChangePassword) return false;

  switch (user.role) {
    case "ADMIN":
    case "MANAGEMENT":
      return true;
    case "LEADER":
      if (team === "management" || !user.viewTeams.includes(team)) {
        return false;
      }
      if (VIEWERS_CAN_EDIT.includes(team)) return true;
      // 수정 권한이 있으면 확정까지 (팀장 = 자기 팀 데이터 수정 가능)
      return action === "view" || user.editTeams.includes(team);
    case "MEMBER":
      if (team === "management" || !user.viewTeams.includes(team)) {
        return false;
      }
      return action === "view" || VIEWERS_CAN_EDIT.includes(team);
  }
}

/** 관리자 설정(직원 권한 변경·비밀번호 초기화·계정 추가·비활성화) */
export function canManageUsers(user: AppUser): boolean {
  return user.active && !user.mustChangePassword && user.role === "ADMIN";
}
