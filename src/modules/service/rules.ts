// 서비스 화면 권한 (화면·Server Action 공용 — 판단은 can() 에 맡긴다). 생산과 같은 방식:
// 관리자·대표·경영지원팀 = 모두, 서비스팀장(수정 권한) = 입력·수정·숨김, 서비스팀원 = 열람만, 생산팀 = 접근 불가
import { can } from "@/shared/auth/can";
import type { AppUser } from "@/shared/auth/types";

export function serviceAbilities(user: AppUser | null) {
  return {
    canView: !!user && can(user, "view", "service"),
    /** 출장보고서 입력·수정·첨부, 부품·출장지·가격 입력·수정 */
    canEdit: !!user && can(user, "edit", "service"),
    /** 숨김·복구 */
    canHide: !!user && can(user, "confirm", "service"),
    /** 출장보고서 일련번호 → 생산 일련번호 검색 링크 (생산 열람 권한이 있을 때만) */
    canSeeProduction: !!user && can(user, "view", "production"),
  };
}

export const NO_EDIT_MESSAGE =
  "서비스 데이터를 수정할 권한이 없습니다. (팀원은 열람만 — 수정은 팀장)";
export const READ_ONLY_LABEL = "열람 전용";
