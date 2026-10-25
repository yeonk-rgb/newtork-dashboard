// 경영지원 변경 이력 — 화면마다 "기록할 칸" 목록(허용 목록)과 대상 이름
// 칸 이름·값은 화면 표기 그대로 (2026-10-25 결정). 여기 없는 칸은 기록되지 않는다
import {
  date,
  flag,
  labelOf,
  text,
  won,
  type AuditField,
} from "@/shared/audit/diff";
import type { AppUser } from "@/shared/auth/types";

import {
  AR_STATUS_LABEL,
  EXPENSE_TYPE_LABEL,
  KIND_LABEL,
  PURCHASE_TYPE_LABEL,
  settleWord,
  type LedgerKind,
} from "./ledger/labels";

export const auditActor = (user: AppUser) => ({
  id: user.id,
  loginId: user.loginId,
});

const monthLabel = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

// ---------- 채권·채무 관리 ----------

export type LedgerAuditRow = {
  year: number;
  month: number;
  kind: LedgerKind;
  arStatus: string | null;
  purchaseType: string | null;
  expenseType: string | null;
  autoTransfer: boolean;
  partnerCode: string | null;
  partnerName: string;
  amount: bigint;
  note: string | null;
  dueOn: Date | null;
  settledOn: Date | null;
};

/** 구분마다 화면에 있는 칸만 (예: 거래처코드는 외상매출금만, 자동이체는 미지급비용-업체만) */
export function ledgerAuditFields(
  kind: LedgerKind,
): AuditField<LedgerAuditRow>[] {
  const word = settleWord(kind);
  return [
    ...(kind === "AR"
      ? [
          { key: "partnerCode", label: "코드" } as const,
          {
            key: "arStatus",
            label: "상태",
            format: labelOf(AR_STATUS_LABEL),
          } as const,
        ]
      : []),
    ...(kind === "AP"
      ? [
          {
            key: "purchaseType",
            label: "매입유형",
            format: labelOf(PURCHASE_TYPE_LABEL),
          } as const,
        ]
      : []),
    ...(kind === "ACCRUED_VENDOR"
      ? [
          {
            key: "expenseType",
            label: "비용유형",
            format: labelOf(EXPENSE_TYPE_LABEL),
          } as const,
          {
            key: "autoTransfer",
            label: "자동이체",
            format: flag("자동이체"),
          } as const,
        ]
      : []),
    { key: "partnerName", label: "거래처명", format: text },
    { key: "amount", label: "잔액", format: won },
    { key: "note", label: "적요", format: text },
    { key: "dueOn", label: `${word} 예정일`, format: date },
    { key: "settledOn", label: `${word} 완료일`, format: date },
  ];
}

/** "2026-10 외상매출금 · 가나상사" */
export function ledgerTargetLabel(row: {
  year: number;
  month: number;
  kind: LedgerKind;
  partnerName: string;
}): string {
  return `${monthLabel(row.year, row.month)} ${KIND_LABEL[row.kind]} · ${row.partnerName}`;
}

// ---------- 미수금 관리 ----------

export type ReceivableAuditRow = {
  customerName: string;
  occurredOn: Date;
  amount: bigint;
  dueOn: Date | null;
  note: string | null;
  isCollected: boolean;
  collectedOn: Date | null;
};

export const RECEIVABLE_AUDIT_FIELDS: AuditField<ReceivableAuditRow>[] = [
  { key: "customerName", label: "거래처", format: text },
  { key: "occurredOn", label: "발생일", format: date },
  { key: "amount", label: "금액", format: won },
  { key: "dueOn", label: "수금 예정일", format: date },
  { key: "note", label: "비고", format: text },
  { key: "isCollected", label: "상태", format: flag("수금 완료", "미수") },
  { key: "collectedOn", label: "수금일", format: date },
];

/** "가나상사 · 2026-09-01 발생" */
export function receivableTargetLabel(row: {
  customerName: string;
  occurredOn: Date;
}): string {
  return `${row.customerName} · ${row.occurredOn.toISOString().slice(0, 10)} 발생`;
}
