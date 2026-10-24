import { describe, expect, it } from "vitest";

import {
  groupArRows,
  kindCounts,
  rowsOfKind,
  sumAmount,
  vendorTotals,
} from "./group";
import type { LedgerRow } from "./rules";

const row = (patch: Partial<LedgerRow>): LedgerRow => ({
  id: patch.partnerName ?? "id",
  kind: "AR",
  arStatus: null,
  purchaseType: null,
  expenseType: null,
  autoTransfer: false,
  partnerCode: null,
  partnerName: "거래처",
  amount: "0",
  note: null,
  dueOn: null,
  settledOn: null,
  updatedAt: "2026-10-24T00:00:00.000Z",
  updatedBy: "seed",
  fromUpload: false,
  hidden: false,
  deletedAt: null,
  deletedBy: null,
  ...patch,
});

const rows = [
  row({ partnerName: "예정1", arStatus: "SCHEDULED", amount: "8800000" }),
  row({ partnerName: "장기1", arStatus: "LONG_OVERDUE", amount: "12500000" }),
  row({ partnerName: "장기2", arStatus: "LONG_OVERDUE", amount: "500000" }),
  row({
    partnerName: "매입",
    kind: "AP",
    purchaseType: "GOODS",
    amount: "4200000",
  }),
  row({ partnerName: "직원", kind: "ACCRUED_STAFF", amount: "350000" }),
];

describe("groupArRows", () => {
  it("장기미수 → 당월수금완료 → 당월수금예정 순서, 빈 그룹도 총액 0으로 남김", () => {
    const groups = groupArRows(rows);
    expect(groups.map((g) => g.status)).toEqual([
      "LONG_OVERDUE",
      "COLLECTED",
      "SCHEDULED",
    ]);
    expect(groups.map((g) => g.total)).toEqual([13_000_000n, 0n, 8_800_000n]);
    expect(groups[1].rows).toEqual([]);
  });

  it("그룹 안 순서는 받은 순서 그대로, 외상매출금 외 구분은 제외", () => {
    expect(groupArRows(rows)[0].rows.map((r) => r.partnerName)).toEqual([
      "장기1",
      "장기2",
    ]);
    expect(
      groupArRows(rows)
        .flatMap((g) => g.rows)
        .some((r) => r.kind !== "AR"),
    ).toBe(false);
  });
});

describe("합계·건수", () => {
  it("sumAmount: 15자리 금액도 BigInt 로 정확히", () => {
    expect(sumAmount([{ amount: "999999999999999" }, { amount: "1" }])).toBe(
      1_000_000_000_000_000n,
    );
    expect(sumAmount([])).toBe(0n);
  });

  it("rowsOfKind·kindCounts", () => {
    expect(rowsOfKind(rows, "AP").map((r) => r.partnerName)).toEqual(["매입"]);
    expect(kindCounts(rows)).toEqual({
      AR: 3,
      AP: 1,
      ACCRUED_STAFF: 1,
      ACCRUED_VENDOR: 0,
    });
  });
});

describe("vendorTotals — 미지급비용-업체 3줄", () => {
  it("총액(자동이체 제외) + 자동이체 합계 = 전체 합계", () => {
    const vendor = [
      row({ kind: "ACCRUED_VENDOR", autoTransfer: true, amount: "165000" }),
      row({ kind: "ACCRUED_VENDOR", amount: "2200000" }),
      row({ kind: "ACCRUED_VENDOR", amount: "380000" }),
      row({ kind: "AR", autoTransfer: true, amount: "999" }),
    ];
    expect(vendorTotals(vendor)).toEqual({
      excludingAutoTransfer: 2_580_000n,
      autoTransfer: 165_000n,
      all: 2_745_000n,
    });
    expect(vendorTotals([])).toEqual({
      excludingAutoTransfer: 0n,
      autoTransfer: 0n,
      all: 0n,
    });
  });
});
