// 채권·채무 표의 그룹·합계 (순수 함수) — 엑셀 '총액' 칸과 같은 값
import {
  AR_STATUSES,
  LEDGER_KINDS,
  type ArStatus,
  type LedgerKind,
} from "./labels";
import type { LedgerRow } from "./rules";

export function sumAmount(rows: { amount: string }[]): bigint {
  return rows.reduce((total, r) => total + BigInt(r.amount), 0n);
}

export type ArGroup = { status: ArStatus; rows: LedgerRow[]; total: bigint };

/**
 * 외상매출금을 상태별로 묶는다. 순서 = 장기미수 → 당월수금완료 → 당월수금예정.
 * 엑셀처럼 행이 없는 그룹도 총액 0으로 남긴다. 그룹 안 순서는 받은 순서 그대로
 */
export function groupArRows(rows: LedgerRow[]): ArGroup[] {
  return AR_STATUSES.map((status) => {
    const list = rows.filter((r) => r.kind === "AR" && r.arStatus === status);
    return { status, rows: list, total: sumAmount(list) };
  });
}

/** 구분 하나의 행만 */
export function rowsOfKind(rows: LedgerRow[], kind: LedgerKind): LedgerRow[] {
  return rows.filter((r) => r.kind === kind);
}

/** 탭에 보여줄 구분별 건수 */
export function kindCounts(rows: LedgerRow[]): Record<LedgerKind, number> {
  return Object.fromEntries(
    LEDGER_KINDS.map((k) => [k, rowsOfKind(rows, k).length]),
  ) as Record<LedgerKind, number>;
}
