import { describe, expect, it } from "vitest";

import {
  getSalesShareByIndustry,
  getSalesShareBySeries,
} from "./production-mock";

const q3 = { unit: "quarter", year: 2026, quarter: 3 } as const;

describe("생산팀 목업", () => {
  it("interface 형식 + source: mock", async () => {
    const result = await getSalesShareByIndustry(q3);
    expect(result.source).toBe("mock");
    expect(result.items.length).toBe(7);
    for (const item of result.items) {
      expect(typeof item.amount).toBe("bigint");
      expect(item.quantity).toBeGreaterThan(0);
    }
  });

  it("금액 내림차순", async () => {
    const { items } = await getSalesShareBySeries(q3);
    const amounts = items.map((i) => i.amount);
    expect([...amounts].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))).toEqual(
      amounts,
    );
    expect(items.every((i) => i.label.includes("목업"))).toBe(true);
  });

  it("같은 기간이면 같은 값 (새로고침해도 그래프가 바뀌지 않음)", async () => {
    expect(await getSalesShareByIndustry(q3)).toEqual(
      await getSalesShareByIndustry(q3),
    );
  });
});
