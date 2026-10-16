// 월간 입력 규칙 (순수 함수): 입력 가능한 달, 상태·권한별 가능한 동작, 자릿수 실수 감지
// 화면(클라이언트)에서도 쓰므로 server-only 인 "@/shared/auth" 대신 순수 모듈을 직접 가져온다
import { can } from "@/shared/auth/can";
import type { AppUser } from "@/shared/auth/types";
import { addMonths, monthIndex, type YearMonth } from "@/shared/period/period";

export type MonthState = "future" | "current" | "closed";
export type EntryStatus = "NEW" | "DRAFT" | "CONFIRMED";

/** 미래 달: 입력 불가 / 이번 달: 임시저장만 / 지난 달: 확정까지 */
export function monthState(ym: YearMonth, today: Date): MonthState {
  const current = monthIndex({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
  });
  const target = monthIndex(ym);
  if (target > current) return "future";
  if (target === current) return "current";
  return "closed";
}

/** 기본 입력 월 = 지난달 */
export function defaultEntryMonth(today: Date): YearMonth {
  return addMonths(
    { year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 },
    -1,
  );
}

export type EntryAbilities = {
  /** 임시저장 가능 (NEW·DRAFT) */
  canSaveDraft: boolean;
  /** 확정 가능 (NEW·DRAFT → CONFIRMED) */
  canConfirm: boolean;
  /** 확정된 달을 확정 상태 그대로 수정 */
  canEditConfirmed: boolean;
  /** 확정 취소 (CONFIRMED → DRAFT) */
  canUnconfirm: boolean;
  /** 모든 칸 읽기 전용 */
  readOnly: boolean;
  /** 화면 안내 문구 (없으면 null) */
  notice: string | null;
};

/**
 * 상태·권한별로 가능한 동작. 서버 Server Action 과 화면이 같은 함수를 쓴다.
 * - edit(팀원 이상): 임시저장 / confirm(팀장·관리자·대표): 확정·확정된 달 수정·확정 취소
 * - 이번 달은 임시저장만 ("월이 끝난 뒤 확정"), 미래 달은 모두 불가
 */
export function entryAbilities(
  user: AppUser,
  status: EntryStatus,
  state: MonthState,
): EntryAbilities {
  const none: EntryAbilities = {
    canSaveDraft: false,
    canConfirm: false,
    canEditConfirmed: false,
    canUnconfirm: false,
    readOnly: true,
    notice: null,
  };
  if (state === "future") {
    return { ...none, notice: "미래 달은 입력할 수 없습니다." };
  }

  const canEdit = can(user, "edit", "management");
  const canConfirmRole = can(user, "confirm", "management");

  if (status === "CONFIRMED") {
    return canConfirmRole
      ? { ...none, canEditConfirmed: true, canUnconfirm: true, readOnly: false }
      : { ...none, notice: "확정된 달은 팀장만 수정할 수 있습니다." };
  }

  if (!canEdit) {
    return { ...none, notice: "입력 권한이 없습니다. (열람만 가능)" };
  }

  if (state === "current") {
    return {
      ...none,
      canSaveDraft: true,
      readOnly: false,
      notice:
        "이번 달은 임시저장만 할 수 있습니다. 월이 끝난 뒤 확정할 수 있습니다.",
    };
  }

  return {
    ...none,
    canSaveDraft: true,
    canConfirm: canConfirmRole,
    readOnly: false,
    notice: canConfirmRole ? null : "확정은 팀장이 합니다 — 팀장 확정 대기",
  };
}

/**
 * 자릿수 실수 의심: 전월의 10배 이상 또는 1/10 이하.
 * 전월 값이 없거나 0원이면 경고하지 않는다.
 */
export function isDigitAnomaly(
  current: bigint,
  previous: bigint | null,
): boolean {
  if (previous === null || previous === 0n) return false;
  return current >= previous * 10n || current * 10n <= previous;
}
