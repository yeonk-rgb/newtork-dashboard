// 경영지원 관리 [지난달 내용 불러오기] 계획 (순수 함수 — 화면·Server Action·테스트 공용, 2026-10-26 결정 05-23)
// 엑셀처럼 지난달 내역을 복사해서 잔액만 고치는 방식. 이번 달이 비어 있을 때만 (중복 방지)
// - 당월 수금 행은 지난달에 이미 받은 돈이라 기본 제외. 포함하면 "당월 수금예정"으로 바꾸고 완료일은 비운다
// - 완료일(수금·지급)은 지난달 날짜라 모두 비운다. 예정일·적요·거래처코드·자동이체는 그대로
import type { ArStatus, ExpenseType, LedgerKind, PurchaseType } from "./labels";
import { LEDGER_KINDS } from "./labels";

export type CopySourceRow = {
  kind: LedgerKind;
  arStatus: ArStatus | null;
  purchaseType: PurchaseType | null;
  expenseType: ExpenseType | null;
  autoTransfer: boolean;
  partnerCode: string | null;
  partnerName: string;
  amount: bigint;
  note: string | null;
  dueOn: Date | null;
  settledOn: Date | null;
};

export type CopyEntry = Omit<CopySourceRow, "settledOn"> & { settledOn: null };

export type CopySummary = {
  /** 구분별 복사할 행 수·금액 (LEDGER_KINDS 순서) */
  kinds: { kind: LedgerKind; count: number; amount: bigint }[];
  /** 지난달 당월 수금 행 (기본 제외) */
  collected: { count: number; amount: bigint };
  total: number;
};

export function planCopy(
  rows: CopySourceRow[],
  opts: { includeCollected: boolean },
): { entries: CopyEntry[]; summary: CopySummary } {
  const collected = { count: 0, amount: 0n };
  const entries: CopyEntry[] = [];
  for (const r of rows) {
    const isCollected = r.kind === "AR" && r.arStatus === "COLLECTED";
    if (isCollected) {
      collected.count += 1;
      collected.amount += r.amount;
      if (!opts.includeCollected) continue;
    }
    entries.push({
      ...r,
      arStatus: isCollected ? "SCHEDULED" : r.arStatus,
      settledOn: null,
    });
  }
  const kinds = LEDGER_KINDS.map((kind) => {
    const of = entries.filter((e) => e.kind === kind);
    return {
      kind,
      count: of.length,
      amount: of.reduce((s, e) => s + e.amount, 0n),
    };
  });
  return { entries, summary: { kinds, collected, total: entries.length } };
}
