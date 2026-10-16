import { describe, expect, it } from "vitest";

import { saveEntrySchema, unconfirmSchema } from "./schemas";

const valid = {
  year: 2026,
  month: 9,
  intent: "draft",
  values: {
    productSales: "215306000",
    goodsSales: "",
    serviceSales: "0",
    goodsPurchase: "1",
    materialPurchase: "999999999999999",
    operatingExpense: "29224000",
  },
  otherExpenses: [{ categoryId: "cat-1", amount: "1686000" }],
  expectedUpdatedAt: "2026-10-14T08:20:00.000Z",
};

describe("saveEntrySchema", () => {
  it("숫자 문자열 → bigint, 빈칸은 0원", () => {
    const parsed = saveEntrySchema.parse(valid);
    expect(parsed.values.productSales).toBe(215_306_000n);
    expect(parsed.values.goodsSales).toBe(0n);
    expect(parsed.values.materialPurchase).toBe(999_999_999_999_999n);
    expect(parsed.otherExpenses[0].amount).toBe(1_686_000n);
  });

  it("음수·소수·콤마·16자리·문자는 거부", () => {
    for (const bad of ["-1", "1.5", "1,000", "1000000000000000", "abc"]) {
      const result = saveEntrySchema.safeParse({
        ...valid,
        values: { ...valid.values, productSales: bad },
      });
      expect(result.success, bad).toBe(false);
    }
  });

  it("연·월 범위, 동작 종류 확인", () => {
    expect(saveEntrySchema.safeParse({ ...valid, month: 13 }).success).toBe(
      false,
    );
    expect(
      saveEntrySchema.safeParse({ ...valid, intent: "delete" }).success,
    ).toBe(false);
    expect(
      saveEntrySchema.safeParse({ ...valid, expectedUpdatedAt: null }).success,
    ).toBe(true);
  });

  it("확정 취소는 updatedAt 필수", () => {
    expect(
      unconfirmSchema.safeParse({
        year: 2026,
        month: 9,
        expectedUpdatedAt: null,
      }).success,
    ).toBe(false);
  });
});
