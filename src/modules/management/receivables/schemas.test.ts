import { describe, expect, it } from "vitest";

import {
  collectReceivableSchema,
  createReceivableSchema,
  updateReceivableSchema,
} from "./schemas";

const base = {
  customerName: "  가나  상하수도(가상) ",
  occurredOn: "2026-09-01",
  amount: "12500000",
  dueOn: "",
  note: "  ",
};

describe("createReceivableSchema", () => {
  it("이름 공백 정리, 금액 BigInt, 빈 예정일·비고는 null", () => {
    const parsed = createReceivableSchema.parse(base);
    expect(parsed).toEqual({
      customerName: "가나 상하수도(가상)",
      occurredOn: "2026-09-01",
      amount: 12_500_000n,
      dueOn: null,
      note: null,
    });
  });

  it("금액: 0원·빈칸·콤마·16자리는 거부", () => {
    for (const amount of ["0", "", "1,000", "1234567890123456", "-5"]) {
      expect(
        createReceivableSchema.safeParse({ ...base, amount }).success,
      ).toBe(false);
    }
  });

  it("거래처 빈칸, 없는 날짜는 거부", () => {
    expect(
      createReceivableSchema.safeParse({ ...base, customerName: "   " })
        .success,
    ).toBe(false);
    expect(
      createReceivableSchema.safeParse({ ...base, occurredOn: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      createReceivableSchema.safeParse({ ...base, dueOn: "내일" }).success,
    ).toBe(false);
  });
});

describe("수정·수금 요청", () => {
  it("수정은 id·expectedUpdatedAt 필수", () => {
    expect(
      updateReceivableSchema.safeParse({ ...base, collectedOn: null }).success,
    ).toBe(false);
    expect(
      updateReceivableSchema.safeParse({
        ...base,
        id: "r1",
        expectedUpdatedAt: "2026-10-01T00:00:00.000Z",
        collectedOn: null,
      }).success,
    ).toBe(true);
  });

  it("수금 처리는 수금일 필수", () => {
    const req = { id: "r1", expectedUpdatedAt: "2026-10-01T00:00:00.000Z" };
    expect(collectReceivableSchema.safeParse(req).success).toBe(false);
    expect(
      collectReceivableSchema.safeParse({ ...req, collectedOn: "2026-10-16" })
        .success,
    ).toBe(true);
  });
});
