// 권한 규칙 — 모든 권한 확인은 이 함수를 거친다. 실제 정책이 확정되면 이 파일의 규칙만 바꾼다.
// 기준: docs/03-meeting-notes-20261014.md 4번 + 해석(docs/05-open-questions.md 14·15번, 고객사 확인 전)
import type { Action, AppUser, Team } from "./types";

export function can(user: AppUser, action: Action, team: Team): boolean {
  // 관리자·대표: 모든 팀 열람·입력·확정
  if (user.role === "ADMIN" || user.role === "CEO") return true;

  // 경영지원팀: 모든 팀 열람
  if (action === "view" && user.team === "management") return true;

  // 그 외에는 자기 팀만
  if (user.team !== team) return false;

  switch (action) {
    case "view":
      return true;
    case "edit":
      // 경영지원팀은 팀원도 월말 입력·임시저장 가능, 다른 팀은 팀장만
      return user.isLeader || team === "management";
    case "confirm":
      return user.isLeader;
  }
}
