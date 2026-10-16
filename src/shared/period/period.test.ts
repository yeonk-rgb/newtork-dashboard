import { describe, expect, it } from "vitest";

import {
  periodEndDate,
  periodLabel,
  periodMonths,
  previousPeriod,
  quarterOf,
  samePeriodLastYear,
  type Period,
} from "./period";

const ym = (months: { year: number; month: number }[]) =>
  months.map(({ year, month }) => `${year}-${month}`);

describe("periodMonths", () => {
  it("월 / 분기 / 연간 / YTD", () => {
    expect(ym(periodMonths({ unit: "month", year: 2026, month: 9 }))).toEqual([
      "2026-9",
    ]);
    expect(
      ym(periodMonths({ unit: "quarter", year: 2026, quarter: 3 })),
    ).toEqual(["2026-7", "2026-8", "2026-9"]);
    expect(periodMonths({ unit: "year", year: 2026 })).toHaveLength(12);
    expect(ym(periodMonths({ unit: "ytd", year: 2026, month: 3 }))).toEqual([
      "2026-1",
      "2026-2",
      "2026-3",
    ]);
  });

  it("잘못된 월은 거부", () => {
    expect(() =>
      periodMonths({ unit: "month", year: 2026, month: 13 }),
    ).toThrow(RangeError);
    expect(() => periodMonths({ unit: "ytd", year: 2026, month: 0 })).toThrow(
      RangeError,
    );
  });
});

describe("previousPeriod / samePeriodLastYear", () => {
  const cases: [Period, Period, Period][] = [
    [
      { unit: "month", year: 2026, month: 1 },
      { unit: "month", year: 2025, month: 12 },
      { unit: "month", year: 2025, month: 1 },
    ],
    [
      { unit: "quarter", year: 2026, quarter: 1 },
      { unit: "quarter", year: 2025, quarter: 4 },
      { unit: "quarter", year: 2025, quarter: 1 },
    ],
    [
      { unit: "quarter", year: 2026, quarter: 3 },
      { unit: "quarter", year: 2026, quarter: 2 },
      { unit: "quarter", year: 2025, quarter: 3 },
    ],
    [
      { unit: "year", year: 2026 },
      { unit: "year", year: 2025 },
      { unit: "year", year: 2025 },
    ],
    [
      { unit: "ytd", year: 2026, month: 9 },
      { unit: "ytd", year: 2025, month: 9 },
      { unit: "ytd", year: 2025, month: 9 },
    ],
  ];

  it.each(cases)("%o → 직전 %o, 전년 동기 %o", (period, previous, lastYear) => {
    expect(previousPeriod(period)).toEqual(previous);
    expect(samePeriodLastYear(period)).toEqual(lastYear);
  });
});

describe("기타", () => {
  it("quarterOf", () => {
    expect([1, 3, 4, 6, 7, 9, 10, 12].map(quarterOf)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4,
    ]);
  });

  it("periodEndDate: 기간 마지막 날", () => {
    expect(
      periodEndDate({ unit: "quarter", year: 2026, quarter: 3 }).toISOString(),
    ).toBe("2026-09-30T00:00:00.000Z");
    expect(
      periodEndDate({ unit: "month", year: 2024, month: 2 }).toISOString(),
    ).toBe("2024-02-29T00:00:00.000Z");
  });

  it("periodLabel", () => {
    expect(periodLabel({ unit: "quarter", year: 2026, quarter: 3 })).toBe(
      "2026년 3분기",
    );
    expect(periodLabel({ unit: "ytd", year: 2026, month: 9 })).toBe(
      "2026년 1~9월 누적",
    );
  });
});
