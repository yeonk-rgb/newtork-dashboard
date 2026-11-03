// 생산 화면 권한 (화면·Server Action 공용 — 판단은 can() 에 맡긴다)
// 처음 요구사항: 관리자·대표·경영지원팀 = 모두, 생산팀장(수정 권한) = 수정, 생산팀원 = 열람만 (2026-11-03 생산 예외 되돌림)
import { can } from "@/shared/auth/can";
import type { AppUser } from "@/shared/auth/types";

export function productionAbilities(user: AppUser | null) {
  return {
    canView: !!user && can(user, "view", "production"),
    /** 업로드·제조내역 수정·사업구분 지정 */
    canEdit: !!user && can(user, "edit", "production"),
    /** 숨김·복구 */
    canHide: !!user && can(user, "confirm", "production"),
  };
}

export const NO_EDIT_MESSAGE =
  "생산 데이터를 수정할 권한이 없습니다. (팀원은 열람만 — 수정은 팀장)";
/** 팀원 화면 표시 */
export const READ_ONLY_LABEL = "열람 전용";
