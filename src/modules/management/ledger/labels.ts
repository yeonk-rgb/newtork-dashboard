// 경영지원 관리 표기 — 항목명·순서는 고객사 엑셀(경영지원_관리.xlsx)과 같게 둔다
// 값은 Prisma enum(management.prisma)과 같은 문자열. 화면(클라이언트)에서도 쓰므로 생성된 Prisma 타입을 가져오지 않는다
import { TERMS } from "../terms";

export const LEDGER_KINDS = [
  "AR",
  "AP",
  "ACCRUED_STAFF",
  "ACCRUED_VENDOR",
] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export const KIND_LABEL: Record<LedgerKind, string> = {
  AR: "외상매출금",
  AP: "외상매입금",
  ACCRUED_STAFF: "미지급비용-직원",
  ACCRUED_VENDOR: "미지급비용-업체",
};

/** 주소(?tab=)에 쓰는 짧은 이름 */
export const KIND_PARAM: Record<LedgerKind, string> = {
  AR: "ar",
  AP: "ap",
  ACCRUED_STAFF: "staff",
  ACCRUED_VENDOR: "vendor",
};

export function parseKindParam(value: string | undefined): LedgerKind {
  return LEDGER_KINDS.find((k) => KIND_PARAM[k] === value) ?? "AR";
}

/** 외상매출금 상태 — 배열 순서 = 화면 그룹 순서 (장기 미수금 → 당월 수금 → 당월 수금예정) */
export const AR_STATUSES = ["LONG_OVERDUE", "COLLECTED", "SCHEDULED"] as const;
export type ArStatus = (typeof AR_STATUSES)[number];

export const AR_STATUS_LABEL: Record<ArStatus, string> = {
  LONG_OVERDUE: TERMS.longOverdue,
  COLLECTED: TERMS.collected,
  SCHEDULED: TERMS.scheduled,
};

/** 그룹 합계 줄 이름 (엑셀 '총액' 옆 메모 문구) */
export const AR_GROUP_TOTAL_LABEL: Record<ArStatus, string> = {
  LONG_OVERDUE: "장기 미수금 업체",
  COLLECTED: "당월 수금된 업체",
  SCHEDULED: "당월 수금예정인 업체",
};

export const PURCHASE_TYPES = ["GOODS", "RAW_MATERIAL"] as const;
export type PurchaseType = (typeof PURCHASE_TYPES)[number];

export const PURCHASE_TYPE_LABEL: Record<PurchaseType, string> = {
  GOODS: "상품매입",
  RAW_MATERIAL: "원재료매입",
};

export const EXPENSE_TYPES = ["ADVERTISING", "ENTERTAINMENT", "OTHER"] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const EXPENSE_TYPE_LABEL: Record<ExpenseType, string> = {
  ADVERTISING: "광고선전비",
  ENTERTAINMENT: "접대비",
  OTHER: "기타",
};

/** 외상매출금 외 탭의 합계 줄 이름 (엑셀 '총액' 옆 메모 문구) */
export const KIND_TOTAL_LABEL: Record<Exclude<LedgerKind, "AR">, string> = {
  AP: "당월 매입 지출",
  ACCRUED_STAFF: "당월 경비 지출",
  ACCRUED_VENDOR: "당월 그 외 지출",
};

/** 예정일·완료일 칸 이름 (채권은 수금, 채무는 지급) */
export function settleWord(kind: LedgerKind): "수금" | "지급" {
  return kind === "AR" ? "수금" : "지급";
}
