// 경영지원 변경 이력 — 화면마다 "기록할 칸" 목록(허용 목록)과 대상 이름
// 칸 이름·값은 화면 표기 그대로 (2026-10-25 결정). 여기 없는 칸은 기록되지 않는다
import {
  date,
  flag,
  labelOf,
  text,
  won,
  type AuditField,
  type AuditFormat,
} from "@/shared/audit/diff";
import type { AuditChange } from "@/shared/audit/types";
import type { AppUser } from "@/shared/auth/types";

import {
  AR_STATUS_LABEL,
  EXPENSE_TYPE_LABEL,
  KIND_LABEL,
  PURCHASE_TYPE_LABEL,
  settleWord,
  type LedgerKind,
} from "./ledger/labels";
import { FIELD_LABEL } from "./entry/field-help";
import type { EntryField } from "./entry/schemas";

export const auditActor = (user: AppUser) => ({
  id: user.id,
  loginId: user.loginId,
});

const monthLabel = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

// ---------- 경영지원 관리 ----------

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

// ---------- 미수금 건별 기록 ----------

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

// ---------- 월간 입력 ----------

export type MonthlyAuditSnapshot = {
  values: Record<EntryField, bigint>;
  status: "DRAFT" | "CONFIRMED" | null;
  /** 그 외 지출: 항목 id → 금액 */
  others: Map<string, bigint>;
};

const ENTRY_STATUS_LABEL = { DRAFT: "임시저장", CONFIRMED: "확정" } as const;

/**
 * 월간 입력의 바뀐 칸: 상태, 금액 6칸, 그 외 지출 항목별 (칸 이름 "그 외 지출 · 광고선전비").
 * 그 외 지출 칸 이름(field)은 항목 id 대신 "otherExpense" — 항목 이름·id 는 사용자가 정하거나 무작위라 금지 칸 검사에 걸릴 수 있다
 */
export function monthlyChanges(
  before: MonthlyAuditSnapshot | null,
  after: MonthlyAuditSnapshot,
  categoryNames: Map<string, string>,
): AuditChange[] {
  const changes: AuditChange[] = [];
  const status = (s: MonthlyAuditSnapshot["status"] | undefined) =>
    s ? ENTRY_STATUS_LABEL[s] : null;
  if (status(before?.status) !== status(after.status)) {
    changes.push({
      field: "status",
      label: "상태",
      before: status(before?.status),
      after: status(after.status),
    });
  }
  for (const key of Object.keys(FIELD_LABEL) as EntryField[]) {
    const b = before ? won(before.values[key]) : null;
    const a = won(after.values[key]);
    if (b !== a) {
      changes.push({
        field: key,
        label: FIELD_LABEL[key],
        before: b,
        after: a,
      });
    }
  }
  const ids = new Set([
    ...(before?.others.keys() ?? []),
    ...after.others.keys(),
  ]);
  for (const id of ids) {
    const b = before?.others.has(id) ? won(before.others.get(id)) : null;
    const a = after.others.has(id) ? won(after.others.get(id)) : null;
    // 0원 ↔ 빈 값은 화면에서 같게 보이므로 기록하지 않는다
    if ((b ?? "0원") === (a ?? "0원")) continue;
    changes.push({
      field: "otherExpense",
      label: `그 외 지출 · ${categoryNames.get(id) ?? "(삭제된 항목)"}`,
      before: b,
      after: a,
    });
  }
  return changes;
}

/** "2026년 10월 월간 입력" */
export const monthlyTargetLabel = (year: number, month: number) =>
  `${year}년 ${month}월 월간 입력`;

// ---------- 목표 설정 ----------

export type TargetAuditRow = {
  revenueTarget: bigint;
  q1Target: bigint | null;
  q2Target: bigint | null;
  q3Target: bigint | null;
  q4Target: bigint | null;
  headcount: number | null;
};

/** 분기 목표가 비어 있으면 화면처럼 "자동 배분" */
const quarterTarget: AuditFormat = (v) =>
  v === null || v === undefined ? "자동 배분" : won(v);

export const TARGET_AUDIT_FIELDS: AuditField<TargetAuditRow>[] = [
  { key: "revenueTarget", label: "연간 목표매출액", format: won },
  { key: "q1Target", label: "1분기 목표", format: quarterTarget },
  { key: "q2Target", label: "2분기 목표", format: quarterTarget },
  { key: "q3Target", label: "3분기 목표", format: quarterTarget },
  { key: "q4Target", label: "4분기 목표", format: quarterTarget },
  {
    key: "headcount",
    label: "직원 수",
    format: (v) => (v === null || v === undefined ? null : `${String(v)}명`),
  },
];

export const targetLabel = (year: number) => `${year}년 목표`;

// ---------- 그 외 지출 항목 ----------

export type CategoryAuditRow = {
  name: string;
  costType: string | null;
  isActive: boolean;
};

export const CATEGORY_AUDIT_FIELDS: AuditField<CategoryAuditRow>[] = [
  { key: "name", label: "항목 이름", format: text },
  {
    key: "costType",
    label: "고정비/변동비",
    format: labelOf({ FIXED: "고정비", VARIABLE: "변동비" }),
  },
  { key: "isActive", label: "사용", format: flag("사용", "비활성") },
];
