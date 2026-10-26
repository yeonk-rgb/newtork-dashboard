// 표 안 입력 행의 값 (순수 함수) — 입력칸 문자열 ↔ 저장 요청 값
import type { ArStatus, ExpenseType, LedgerKind, PurchaseType } from "./labels";
import type { LedgerRow } from "./rules";
import type { CreateLedgerInput } from "./schemas";

/** 빈 선택 = "" (저장할 때 Zod 가 "골라 주세요"로 막는다) */
export type LedgerDraft = {
  arStatus: ArStatus | "";
  purchaseType: PurchaseType | "";
  expenseType: ExpenseType | "";
  autoTransfer: boolean;
  partnerCode: string;
  partnerName: string;
  /** 콤마 없는 숫자 문자열 */
  amount: string;
  note: string;
  dueOn: string;
  settledOn: string;
};

/**
 * 새 행 기본값: 외상매출금 = 당월 수금예정, 미지급비용-업체 = 기타.
 * 외상매입금 매입유형은 판별할 수 없어 비워 두고 직접 고르게 한다
 */
export function emptyDraft(kind: LedgerKind): LedgerDraft {
  return {
    arStatus: kind === "AR" ? "SCHEDULED" : "",
    purchaseType: "",
    expenseType: kind === "ACCRUED_VENDOR" ? "OTHER" : "",
    autoTransfer: false,
    partnerCode: "",
    partnerName: "",
    amount: "",
    note: "",
    dueOn: "",
    settledOn: "",
  };
}

export function draftFromRow(row: LedgerRow): LedgerDraft {
  return {
    arStatus: row.arStatus ?? "",
    purchaseType: row.purchaseType ?? "",
    expenseType: row.expenseType ?? "",
    autoTransfer: row.autoTransfer,
    partnerCode: row.partnerCode ?? "",
    partnerName: row.partnerName,
    amount: row.amount,
    note: row.note ?? "",
    dueOn: row.dueOn ?? "",
    settledOn: row.settledOn ?? "",
  };
}

/** 외상매출금 상태를 바꿀 때: 당월 수금이 아니면 완료일을 지운다 */
export function withArStatus(
  draft: LedgerDraft,
  status: ArStatus,
  settledOn = "",
): LedgerDraft {
  return {
    ...draft,
    arStatus: status,
    settledOn: status === "COLLECTED" ? settledOn : "",
  };
}

/** 저장 요청의 fields (구분에 해당하는 칸만 보낸다) */
export function draftToFields(
  kind: LedgerKind,
  draft: LedgerDraft,
): CreateLedgerInput["fields"] {
  const common = {
    partnerName: draft.partnerName,
    amount: draft.amount,
    note: draft.note,
    dueOn: draft.dueOn,
    settledOn: draft.settledOn,
  };
  switch (kind) {
    case "AR":
      return {
        kind,
        arStatus: draft.arStatus as ArStatus,
        partnerCode: draft.partnerCode,
        ...common,
      };
    case "AP":
      return {
        kind,
        purchaseType: draft.purchaseType as PurchaseType,
        ...common,
      };
    case "ACCRUED_STAFF":
      return { kind, ...common };
    case "ACCRUED_VENDOR":
      return {
        kind,
        expenseType: draft.expenseType as ExpenseType,
        autoTransfer: draft.autoTransfer,
        ...common,
      };
  }
}
