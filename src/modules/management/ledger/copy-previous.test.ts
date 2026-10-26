import { describe, expect, it } from "vitest";

import { planCopy, type CopySourceRow } from "./copy-previous";

const base: CopySourceRow = {
  kind: "AR",
  arStatus: "SCHEDULED",
  purchaseType: null,
  expenseType: null,
  autoTransfer: false,
  partnerCode: "0012345678",
  partnerName: "가나상사(가상)",
  amount: 10_000_000n,
  note: "10/15",
  dueOn: new Date("2026-10-31T00:00:00Z"),
  settledOn: null,
};

const ROWS: CopySourceRow[] = [
  { ...base, arStatus: "LONG_OVERDUE", partnerName: "장기(가상)" },
  {
    ...base,
    arStatus: "COLLECTED",
    partnerName: "수금(가상)",
    amount: 3_000_000n,
    settledOn: new Date("2026-09-25T00:00:00Z"),
  },
  base,
  {
    ...base,
    kind: "AP",
    arStatus: null,
    partnerCode: null,
    purchaseType: "GOODS",
    amount: 2_200_000n,
    settledOn: new Date("2026-09-30T00:00:00Z"),
  },
  {
    ...base,
    kind: "ACCRUED_VENDOR",
    arStatus: null,
    partnerCode: null,
    expenseType: "OTHER",
    autoTransfer: true,
    amount: 165_000n,
  },
];

describe("지난달 내용 불러오기 계획", () => {
  it("기본: 당월 수금 행 제외, 완료일은 비우고 나머지 칸은 그대로 (순서 유지)", () => {
    const { entries, summary } = planCopy(ROWS, { includeCollected: false });
    expect(entries.map((e) => e.partnerName)).toEqual([
      "장기(가상)",
      "가나상사(가상)",
      "가나상사(가상)",
      "가나상사(가상)",
    ]);
    expect(entries.every((e) => e.settledOn === null)).toBe(true);
    expect(entries[1]).toMatchObject({
      partnerCode: "0012345678",
      note: "10/15",
      dueOn: new Date("2026-10-31T00:00:00Z"),
    });
    expect(entries[3]).toMatchObject({
      kind: "ACCRUED_VENDOR",
      autoTransfer: true,
      expenseType: "OTHER",
    });
    expect(summary).toEqual({
      kinds: [
        { kind: "AR", count: 2, amount: 20_000_000n },
        { kind: "AP", count: 1, amount: 2_200_000n },
        { kind: "ACCRUED_STAFF", count: 0, amount: 0n },
        { kind: "ACCRUED_VENDOR", count: 1, amount: 165_000n },
      ],
      collected: { count: 1, amount: 3_000_000n },
      total: 4,
    });
  });

  it("당월 수금 행을 포함하면 당월 수금예정으로 바꾸고 완료일을 비운다", () => {
    const { entries, summary } = planCopy(ROWS, { includeCollected: true });
    const copied = entries.find((e) => e.partnerName === "수금(가상)");
    expect(copied).toMatchObject({ arStatus: "SCHEDULED", settledOn: null });
    expect(summary.total).toBe(5);
    expect(summary.kinds[0]).toEqual({
      kind: "AR",
      count: 3,
      amount: 23_000_000n,
    });
  });

  it("지난달이 비어 있으면 아무것도 없음", () => {
    expect(planCopy([], { includeCollected: false }).summary.total).toBe(0);
  });
});
