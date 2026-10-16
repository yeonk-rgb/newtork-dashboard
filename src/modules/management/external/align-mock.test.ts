import { describe, expect, it } from "vitest";

import type { SalesShareResult } from "@/shared/contracts/production";

import { alignMockToTotal } from "./align-mock";

const mock: SalesShareResult = {
  source: "mock",
  items: [
    { key: "A", label: "A", amount: 600n, quantity: 6 },
    { key: "B", label: "B", amount: 300n, quantity: 3 },
    { key: "C", label: "C", amount: 100n, quantity: 1 },
  ],
};
const sumOf = (r: SalesShareResult) =>
  r.items.reduce((acc, i) => acc + i.amount, 0n);

describe("alignMockToTotal", () => {
  it("합계를 실제 총매출과 정확히 같게, 비중은 유지", () => {
    const aligned = alignMockToTotal(mock, 481_773_000n);
    expect(sumOf(aligned)).toBe(481_773_000n);
    const [a, b, c] = aligned.items.map((i) => Number(i.amount));
    expect(a / 481_773_000).toBeCloseTo(0.6, 6);
    expect(b / 481_773_000).toBeCloseTo(0.3, 6);
    expect(c / 481_773_000).toBeCloseTo(0.1, 6);
  });

  it("나누어떨어지지 않아도 원 단위까지 합계 일치", () => {
    expect(sumOf(alignMockToTotal(mock, 1_000_001n))).toBe(1_000_001n);
  });

  it("확정 매출이 0이면 빈 목록 (→ 확정 데이터 없음 안내)", () => {
    expect(alignMockToTotal(mock, 0n).items).toEqual([]);
  });

  it("실제 생산팀 데이터는 그대로", () => {
    const real: SalesShareResult = { ...mock, source: "production" };
    expect(alignMockToTotal(real, 5n)).toBe(real);
  });
});
