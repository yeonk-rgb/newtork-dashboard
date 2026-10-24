// 채권·채무 관리 규칙 (순수 함수): 권한별 가능한 동작, 기준년월, 날짜 검사
// 화면(클라이언트)에서도 쓰므로 server-only 인 "@/shared/auth" 대신 순수 모듈을 직접 가져온다
import { can } from "@/shared/auth/can";
import type { AppUser } from "@/shared/auth/types";
import type { YearMonth } from "@/shared/period/period";

import { parseDateOnly } from "../receivables/rules";
import type { ArStatus, ExpenseType, LedgerKind, PurchaseType } from "./labels";

export { parseDateOnly, toDateOnly } from "../receivables/rules";

/** 화면에 넘기는 한 행 (날짜는 "YYYY-MM-DD", 금액은 정수 문자열) */
export type LedgerRow = {
  id: string;
  kind: LedgerKind;
  arStatus: ArStatus | null;
  purchaseType: PurchaseType | null;
  expenseType: ExpenseType | null;
  autoTransfer: boolean;
  partnerCode: string | null;
  partnerName: string;
  amount: string;
  note: string | null;
  dueOn: string | null;
  settledOn: string | null;
  /** 동시 수정 확인용 (ISO) */
  updatedAt: string;
  updatedBy: string;
  hidden: boolean;
  /** 숨긴 일시 (ISO) */
  deletedAt: string | null;
  deletedBy: string | null;
};

// ---------- 권한 ----------

export type LedgerAbilities = {
  canEdit: boolean;
  canHide: boolean;
  canRestore: boolean;
  /** 버튼이 없을 때 보여줄 안내 */
  notice: string | null;
};

/** 행 추가: edit (2026-10-24 결정: 관리자·경영지원팀 전원 — 고객사 확인 대기 05-14·15) */
export function canCreateLedgerEntry(user: AppUser): boolean {
  return can(user, "edit", "management");
}

/** 숨긴 항목 보기·복구: confirm (미수금 관리와 같은 기준) */
export function canManageHiddenLedger(user: AppUser): boolean {
  return can(user, "confirm", "management");
}

/**
 * 행별로 가능한 동작. 서버 Server Action 과 화면이 같은 함수를 쓴다.
 * - 수정: edit / 숨김·복구: confirm
 * - 숨긴 행은 복구 외에 아무것도 못 한다
 */
export function ledgerAbilities(
  user: AppUser,
  row: { hidden: boolean },
): LedgerAbilities {
  const edit = can(user, "edit", "management");
  const confirm = can(user, "confirm", "management");
  const none: LedgerAbilities = {
    canEdit: false,
    canHide: false,
    canRestore: false,
    notice: null,
  };
  if (row.hidden) {
    return confirm
      ? { ...none, canRestore: true }
      : { ...none, notice: "숨긴 항목은 팀장만 복구할 수 있습니다." };
  }
  return {
    ...none,
    canEdit: edit,
    canHide: confirm,
    notice: edit ? null : "열람만 가능합니다.",
  };
}

// ---------- 기준년월 ----------

/** "2026-09" → {2026, 9}. 형식이 틀리면 null */
export function parseLedgerMonth(value: string | undefined): YearMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

/** {2026, 9} → "2026-09" (input type="month" 값과 같은 형식) */
export function formatLedgerMonth(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, "0")}`;
}

/** today "YYYY-MM-DD" 가 속한 달 */
export function monthOfDate(today: string): YearMonth {
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

/** 이번 달보다 뒤의 달 (입력 불가) */
export function isFutureMonth(ym: YearMonth, today: string): boolean {
  return formatLedgerMonth(ym) > today.slice(0, 7);
}

// ---------- 거래처 ----------

export const PARTNER_NAME_MAX = 50;
export const NOTE_MAX = 200;
export const PARTNER_CODE_LENGTH = 10;

/** 앞뒤 공백 제거, 연속 공백 하나로 */
export function normalizePartnerName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** 거래처코드: 숫자 10자리 문자열만 (앞자리 0 유지) */
export function isPartnerCode(value: string): boolean {
  return new RegExp(`^\\d{${PARTNER_CODE_LENGTH}}$`).test(value);
}

// ---------- 날짜 ----------

export type LedgerDateFields = {
  kind: LedgerKind;
  arStatus: ArStatus | null;
  dueOn: string | null;
  settledOn: string | null;
};

/**
 * 날짜 규칙 위반 (필드 → 메시지). 비어 있으면 통과.
 * - 완료일: 오늘 이후 불가. 외상매출금은 당월수금완료일 때만 입력하고, 그때는 필수
 * - 예정일: 제한 없음 (형식만)
 * @param today "YYYY-MM-DD" (한국 날짜)
 */
export function ledgerDateErrors(
  fields: LedgerDateFields,
  today: string,
): Partial<Record<"dueOn" | "settledOn", string>> {
  const errors: Partial<Record<"dueOn" | "settledOn", string>> = {};
  if (fields.dueOn && !parseDateOnly(fields.dueOn)) {
    errors.dueOn = "예정일 형식이 올바르지 않습니다.";
  }

  const isAr = fields.kind === "AR";
  const collected = isAr && fields.arStatus === "COLLECTED";
  if (!fields.settledOn) {
    if (collected) errors.settledOn = "수금 완료일을 입력하세요.";
  } else if (!parseDateOnly(fields.settledOn)) {
    errors.settledOn = "완료일 형식이 올바르지 않습니다.";
  } else if (fields.settledOn > today) {
    errors.settledOn = "완료일은 오늘 이후로 입력할 수 없습니다.";
  } else if (isAr && !collected) {
    errors.settledOn = "완료일은 당월수금완료일 때만 입력합니다.";
  }
  return errors;
}
