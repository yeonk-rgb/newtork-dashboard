// 경영지원 관리 표의 그룹·합계 (순수 함수) — 엑셀 '총액' 칸과 같은 값
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
 * 외상매출금을 상태별로 묶는다. 순서 = 장기 미수금 → 당월 수금 → 당월 수금예정.
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

export type VendorTotals = {
  /** 엑셀 F열 SUM 과 같은 값 (원본 SUM(D67:D79)이 66행 자동이체를 뺌) — '당월 그 외 지출' */
  excludingAutoTransfer: bigint;
  autoTransfer: bigint;
  all: bigint;
};

/** 미지급비용-업체 합계 3줄 (2026-10-25 결정: 금액이 빠져 보이지 않게 셋 다 표시, 의도 확인 05-25) */
export function vendorTotals(rows: LedgerRow[]): VendorTotals {
  const vendor = rowsOfKind(rows, "ACCRUED_VENDOR");
  const autoTransfer = sumAmount(vendor.filter((r) => r.autoTransfer));
  const all = sumAmount(vendor);
  return { excludingAutoTransfer: all - autoTransfer, autoTransfer, all };
}
