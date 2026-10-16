import { describe, expect, it } from "vitest";

import type { Period } from "./period";
import { lastCompletedQuarter, parsePeriodParam, toPeriodParam } from "./url";

describe("period URL 값", () => {
  const cases: [string, Period][] = [
    ["2026-Q3", { unit: "quarter", year: 2026, quarter: 3 }],
    ["2026-09", { unit: "month", year: 2026, month: 9 }],
    ["2026", { unit: "year", year: 2026 }],
    ["2026-YTD09", { unit: "ytd", year: 2026, month: 9 }],
  ];

  it.each(cases)("%s ↔ %o", (param, period) => {
    expect(parsePeriodParam(param)).toEqual(period);
    expect(toPeriodParam(period)).toBe(param);
  });

  it("소문자도 허용", () => {
    expect(parsePeriodParam("2026-q2")).toEqual({
      unit: "quarter",
      year: 2026,
      quarter: 2,
    });
  });

  it("잘못된 값은 null", () => {
    for (const bad of [
      null,
      "",
      "2026-Q5",
      "2026-13",
      "2026-YTD00",
      "abc",
      "1999",
      "2026-9",
      "2026-Q3x",
    ]) {
      expect(parsePeriodParam(bad)).toBeNull();
    }
  });
});

describe("lastCompletedQuarter", () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

  it("4분기 중이면 3분기", () => {
    expect(lastCompletedQuarter(d("2026-10-16"))).toEqual({
      unit: "quarter",
      year: 2026,
      quarter: 3,
    });
  });

  it("분기 마지막 날에도 아직 그 분기는 안 끝남", () => {
    expect(lastCompletedQuarter(d("2026-09-30"))).toEqual({
      unit: "quarter",
      year: 2026,
      quarter: 2,
    });
  });

  it("1분기 중이면 전년 4분기", () => {
    expect(lastCompletedQuarter(d("2027-02-01"))).toEqual({
      unit: "quarter",
      year: 2026,
      quarter: 4,
    });
  });
});
