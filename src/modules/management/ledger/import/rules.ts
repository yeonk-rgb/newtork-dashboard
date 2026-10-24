// 채권·채무 엑셀 이관 규칙 (순수 함수) — 화면과 Server Action 이 같이 쓴다
import { can } from "@/shared/auth/can";
import type { AppUser } from "@/shared/auth/types";

/** 파일 1개, 5MB 까지 (고객사 양식은 약 14KB) */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type ImportAbilities = {
  /** 파일 올리기·미리보기·추가로 가져오기: edit */
  canImport: boolean;
  /** 덮어쓰기(같은 달 기존 행 숨김): confirm — 1단계 숨김과 같은 기준 */
  canOverwrite: boolean;
};

export function importAbilities(user: AppUser): ImportAbilities {
  return {
    canImport: can(user, "edit", "management"),
    canOverwrite: can(user, "confirm", "management"),
  };
}

/** 파일 기본 검사 (서버에서 다시 확인) */
export function importFileError(file: {
  name: string;
  size: number;
}): string | null {
  if (file.size === 0) return "빈 파일입니다.";
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return ".xlsx 파일만 올릴 수 있습니다.";
  }
  if (file.size > MAX_IMPORT_BYTES) return "파일이 5MB를 넘습니다.";
  return null;
}
