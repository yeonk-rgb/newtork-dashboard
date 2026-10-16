import { describe, expect, it } from "vitest";

import {
  agingBucket,
  computeReceivables,
  isOutstandingAt,
} from "./receivables";
import { date, receivable } from "./test-fixtures";

const asOf = date("2026-09-30");

describe("isOutstandingAt: 기준일 시점 미수 여부", () => {
  it("기준일 이후 발생은 제외", () => {
    expect(
      isOutstandingAt(
        receivable("a", { occurredOn: date("2026-10-01") }),
        asOf,
      ),
    ).toBe(false);
  });

  it("기준일 이후에 수금된 건은 그 시점엔 미수", () => {
    const r = receivable("a", {
      isCollected: true,
      collectedOn: date("2026-10-05"),
    });
    expect(isOutstandingAt(r, asOf)).toBe(true);
    expect(isOutstandingAt(r, date("2026-10-10"))).toBe(false);
  });

  it("수금 완료인데 수금일이 없으면 수금된 것으로 본다", () => {
    expect(isOutstandingAt(receivable("a", { isCollected: true }), asOf)).toBe(
      false,
    );
  });
});

describe("agingBucket", () => {
  it("0~30 / 31~60 / 61~90 / 90일 초과", () => {
    expect([0, 30, 31, 60, 61, 90, 91, 400].map(agingBucket)).toEqual([
      "0-30",
      "0-30",
      "31-60",
      "31-60",
      "61-90",
      "61-90",
      "90+",
      "90+",
    ]);
  });
});

describe("computeReceivables", () => {
  const list = [
    receivable("1", {
      customerName: "다라(가상)",
      occurredOn: date("2026-09-20"),
      amount: 300n,
      dueOn: date("2026-10-31"),
    }),
    receivable("2", {
      customerName: "가나(가상)",
      occurredOn: date("2026-08-15"),
      amount: 500n,
      dueOn: date("2026-09-10"),
    }),
    receivable("3", {
      customerName: "다라(가상)",
      occurredOn: date("2026-07-10"),
      amount: 300n,
      dueOn: date("2027-06-30"),
    }),
    receivable("4", {
      customerName: "마바(가상)",
      occurredOn: date("2026-03-01"),
      amount: 100n,
    }),
    receivable("5", {
      customerName: "마바(가상)",
      occurredOn: date("2026-01-01"),
      amount: 999n,
      isCollected: true,
      collectedOn: date("2026-02-01"),
    }),
  ];
  const result = computeReceivables(list, asOf, 6);

  it("총액·건수 (수금 완료 제외)", () => {
    expect(result.total).toBe(1_200n);
    expect(result.count).toBe(4);
  });

  it("거래처별 순위: 금액 큰 순, 같으면 이름순", () => {
    expect(
      result.byCustomer.map((c) => [c.customerName, c.amount, c.count]),
    ).toEqual([
      ["다라(가상)", 600n, 2],
      ["가나(가상)", 500n, 1],
      ["마바(가상)", 100n, 1],
    ]);
  });

  it("경과일 구간 (발생일 기준)", () => {
    // 9/20 → 10일, 8/15 → 46일, 7/10 → 82일, 3/1 → 213일
    expect(result.aging.map((a) => [a.bucket, a.amount])).toEqual([
      ["0-30", 300n],
      ["31-60", 500n],
      ["61-90", 300n],
      ["90+", 100n],
    ]);
  });

  it("수금 예정: 예정일 지남 / 향후 6개월 / 이후 / 예정일 없음", () => {
    const { expected } = result;
    expect(expected.overdue).toEqual({ amount: 500n, count: 1 });
    expect(expected.months.map((m) => `${m.year}-${m.month}`)).toEqual([
      "2026-9",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-1",
      "2027-2",
    ]);
    expect(expected.months[1]).toMatchObject({ amount: 300n, count: 1 });
    expect(expected.later).toEqual({ amount: 300n, count: 1 });
    expect(expected.noDueDate).toEqual({ amount: 100n, count: 1 });
  });

  it("미수금 없음", () => {
    const empty = computeReceivables([], asOf, 6);
    expect(empty.total).toBe(0n);
    expect(empty.byCustomer).toEqual([]);
    expect(empty.aging.every((a) => a.amount === 0n)).toBe(true);
  });
});
