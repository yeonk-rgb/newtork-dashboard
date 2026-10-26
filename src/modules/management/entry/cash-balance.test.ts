// 월간 입력 "월말 통장 잔액" (선택 칸, 2026-10-26 결정 05-41) — 빈칸은 null(0원과 다름), 변경 이력, 브라우저 임시 보관
import { describe, expect, it } from "vitest";

import { monthlyChanges, type MonthlyAuditSnapshot } from "../audit-fields";
import { parseDraft } from "./draft-storage";
import { saveEntrySchema } from "./schemas";

const base = {
  year: 2026,
  month: 9,
  intent: "draft" as const,
  values: {
    productSales: "",
    goodsSales: "",
    serviceSales: "",
    goodsPurchase: "",
    materialPurchase: "",
    operatingExpense: "",
  },
  otherExpenses: [],
  expectedUpdatedAt: null,
};

describe("월말 통장 잔액 검증", () => {
  it("빈칸·없음 = null, 숫자 = bigint, 글자는 거부", () => {
    expect(saveEntrySchema.parse(base).cashBalance).toBeNull();
    expect(
      saveEntrySchema.parse({ ...base, cashBalance: "" }).cashBalance,
    ).toBeNull();
    expect(
      saveEntrySchema.parse({ ...base, cashBalance: "0" }).cashBalance,
    ).toBe(0n);
    expect(
      saveEntrySchema.parse({ ...base, cashBalance: "250000000" }).cashBalance,
    ).toBe(250_000_000n);
    expect(
      saveEntrySchema.safeParse({ ...base, cashBalance: "-1" }).success,
    ).toBe(false);
  });
});

describe("변경 이력", () => {
  const snap = (cashBalance?: bigint | null): MonthlyAuditSnapshot => ({
    values: {
      productSales: 0n,
      goodsSales: 0n,
      serviceSales: 0n,
      goodsPurchase: 0n,
      materialPurchase: 0n,
      operatingExpense: 0n,
    },
    status: "CONFIRMED",
    others: new Map(),
    cashBalance,
  });
  const cashLines = (b: MonthlyAuditSnapshot | null, a: MonthlyAuditSnapshot) =>
    monthlyChanges(b, a, new Map()).filter((c) => c.field === "cashBalance");

  it("바뀌면 '월말 통장 잔액: A → B', 비움은 (없음), 0원과 빈칸은 다름", () => {
    expect(cashLines(snap(null), snap(250_000_000n))).toEqual([
      {
        field: "cashBalance",
        label: "월말 통장 잔액",
        before: null,
        after: "250,000,000원",
      },
    ]);
    expect(cashLines(snap(0n), snap(null))[0]).toMatchObject({
      before: "0원",
      after: null,
    });
    expect(cashLines(snap(5n), snap(5n))).toEqual([]);
    // 값을 넘기지 않은 호출(예전 화면)은 비교하지 않음
    expect(cashLines(snap(5n), snap(undefined))).toEqual([]);
  });
});

describe("브라우저 임시 보관", () => {
  const raw = (cash: unknown) =>
    JSON.stringify({
      v: 1,
      values: {},
      other: {},
      cash,
      baseUpdatedAt: null,
      savedAt: "2026-10-26T00:00:00Z",
    });
  it("예전 보관값(cash 없음)도 읽고, 숫자 아닌 값은 버린다", () => {
    expect(parseDraft(raw(undefined))?.cash).toBeUndefined();
    expect(parseDraft(raw("1200"))?.cash).toBe("1200");
    expect(parseDraft(raw("12a"))).toBeNull();
  });
});
