// 엑셀 업로드 권한 (순수 함수 — 화면·Server Action 공용)
// 화면에서도 쓰므로 server-only 인 "@/shared/auth" 대신 순수 모듈을 직접 가져온다
import { can } from "@/shared/auth/can";
import type { AppUser } from "@/shared/auth/types";

export type UploadAbilities = {
  /** 화면·미리보기·양식 다운로드 (경영지원 열람) */
  canView: boolean;
  /** 저장 (관리자·대표·경영지원 팀장) */
  canSave: boolean;
  notice: string | null;
};

export function uploadAbilities(user: AppUser): UploadAbilities {
  if (!can(user, "view", "management")) {
    return { canView: false, canSave: false, notice: null };
  }
  const canSave = can(user, "confirm", "management");
  return {
    canView: true,
    canSave,
    notice: canSave
      ? null
      : "미리보기는 할 수 있지만 저장은 관리자·대표·경영지원 팀장만 할 수 있습니다.",
  };
}

/** 한 번에 올릴 수 있는 파일 수·크기 */
export const MAX_FILES = 10;
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
