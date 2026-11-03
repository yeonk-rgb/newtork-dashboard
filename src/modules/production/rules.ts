// 생산 화면 권한 (화면·Server Action 공용 — 판단은 can() 에 맡긴다)
// 생산은 열람 범위만 있으면 팀원도 입력·수정 (shared/auth/types VIEWERS_CAN_EDIT, 2026-11-03 사용자 결정)
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

export const NO_EDIT_MESSAGE = "생산 데이터를 수정할 권한이 없습니다.";
