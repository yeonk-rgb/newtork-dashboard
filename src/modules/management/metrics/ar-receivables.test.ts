// 대시보드 미수금 = 채권·채무 외상매출금 (2026-10-26, 05-22)
import { describe, expect, it } from "vitest";

import { arBaseMonth, computeArReceivables } from "./ar-receivables";
import { arEntry, date } from "./test-fixtures";

const Q3 = { unit: "quarter", year: 2026, quarter: 3 } as const;
const today = date("2026-10-16");

describe("기준월 = 기간 안에서 외상매출금 행이 있는 마지막 달 (오늘이 속한 달까지)", () => {
  it("3분기에 8월만 있으면 8월, 9월도 있으면 9월", () => {
    expect(arBaseMonth([arEntry("a", { month: 8 })], Q3, today)).toEqual({
      year: 2026,
      month: 8,
    });
    expect(
      arBaseMonth(
        [arEntry("a", { month: 8 }), arEntry("b", { month: 9 })],
        Q3,
        today,
      ),
    ).toEqual({ year: 2026, month: 9 });
  });

  it("기간 밖·오늘 이후 달은 고르지 않음 (다른 기간 값을 끌어오지 않음)", () => {
    const entries = [arEntry("a", { month: 6 }), arEntry("b", { month: 11 })];
    expect(arBaseMonth(entries, Q3, today)).toBeNull();
    expect(arBaseMonth(entries, { unit: "year", year: 2026 }, today)).toEqual({
      year: 2026,
      month: 6,
    }); // 11월은 오늘(10월) 이후
  });
});

describe("미수 = 장기미수 + 당월수금예정, 당월수금완료는 따로", () => {
  const entries = [
    arEntry("long", {
      status: "LONG_OVERDUE",
      partnerName: "다라(가상)",
      amount: 80n,
    }),
    arEntry("s1", {
      partnerName: "다라(가상)",
      amount: 30n,
      dueOn: date("2026-09-10"),
    }),
    arEntry("s2", {
      partnerName: "카타(가상)",
      amount: 50n,
      dueOn: date("2026-11-05"),
    }),
    arEntry("s3", { partnerName: "거나(가상)", amount: 20n }),
    arEntry("done", {
      status: "COLLECTED",
      partnerName: "사아(가상)",
      amount: 999n,
      settledOn: date("2026-09-20"),
    }),
    // 다른 달 행은 섞지 않는다
    arEntry("aug", { month: 8, amount: 7_000n }),
  ];
  const r = computeArReceivables(entries, Q3, today, 6);

  it("합계·상태별·기준일", () => {
    expect(r.month).toEqual({ year: 2026, month: 9 });
    expect(r.asOf.toISOString()).toBe("2026-09-30T00:00:00.000Z");
    expect(r.isCurrentMonth).toBe(false);
    expect(r.total).toBe(180n);
    expect(r.total).toBe(r.longOverdue.amount + r.scheduled.amount);
    expect(r.longOverdue).toEqual({ amount: 80n, count: 1 });
    expect(r.scheduled).toEqual({ amount: 100n, count: 3 });
    expect(r.collected).toEqual({ amount: 999n, count: 1 });
    expect(r.count).toBe(4);
  });

  it("거래처별 (금액 큰 순) + 그중 장기미수", () => {
    expect(r.customerCount).toBe(3);
    expect(r.byCustomer).toEqual([
      { customerName: "다라(가상)", amount: 110n, count: 2, longOverdue: 80n },
      { customerName: "카타(가상)", amount: 50n, count: 1, longOverdue: 0n },
      { customerName: "거나(가상)", amount: 20n, count: 1, longOverdue: 0n },
    ]);
  });

  it("수금 예정: 당월수금예정 행의 예정일 (지남·월별·없음), 장기미수는 넣지 않음", () => {
    expect(r.expected.overdue).toEqual({ amount: 30n, count: 1 });
    expect(r.expected.noDueDate).toEqual({ amount: 20n, count: 1 });
    expect(r.expected.months[0]).toMatchObject({ year: 2026, month: 9 });
    expect(r.expected.months.find((m) => m.month === 11)?.amount).toBe(50n);
    expect(r.items.find((i) => i.id === "s1")?.isOverdue).toBe(true);
    expect(r.items.find((i) => i.id === "long")?.isOverdue).toBe(false);
  });
});

describe("입력 없음", () => {
  it("기간에 외상매출금 행이 없으면 month null, 0원, 기준일 = min(기간 말일, 오늘)", () => {
    const r = computeArReceivables([], Q3, today, 6);
    expect(r.month).toBeNull();
    expect(r.total).toBe(0n);
    expect(r.items).toEqual([]);
    expect(r.asOf.toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });

  it("이번 달이 기준월이면 기준일 = 오늘, 작성 중 표시", () => {
    const r = computeArReceivables(
      [arEntry("a", { month: 10 })],
      { unit: "quarter", year: 2026, quarter: 4 },
      today,
      6,
    );
    expect(r.month).toEqual({ year: 2026, month: 10 });
    expect(r.isCurrentMonth).toBe(true);
    expect(r.asOf).toBe(today);
  });
});
