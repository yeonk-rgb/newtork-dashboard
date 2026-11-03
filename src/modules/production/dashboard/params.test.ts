// 생산 대시보드 주소 연동 규칙 — 친구 화면의 watch 규칙과 같게
import { describe, expect, it } from "vitest";

import {
  dashboardHref,
  parseDashboardParams,
  withQuarter,
  withScope,
  withYear,
} from "./params";

const TODAY = { year: 2026, month: 11 };
const base = parseDashboardParams({}, TODAY);

describe("생산 대시보드 주소", () => {
  it("기본: 올해·연간·납기 예정은 이번 달, 다른 해면 1월", () => {
    expect(base).toMatchObject({
      year: 2026,
      quarter: 0,
      scope: "year",
      due: 11,
      unit: "month",
      tab: "month",
    });
    expect(parseDashboardParams({ year: "2025" }, TODAY).due).toBe(1);
  });
  it("위쪽 분기를 고르면 아래도 같은 분기, 납기 예정 월은 그 분기 첫 달로", () => {
    expect(withQuarter(base, 3)).toEqual({ quarter: 3, scope: "q3", due: 7 });
    expect(withQuarter({ ...base, due: 8 }, 3).due).toBe(8);
  });
  it("아래에서 월을 고르면 위쪽은 그대로, 납기 예정 월만 / 분기를 고르면 위쪽도", () => {
    expect(withScope({ ...base, quarter: 2 }, "m5")).toEqual({
      scope: "m5",
      due: 5,
    });
    expect(withScope(base, "q2")).toMatchObject({
      quarter: 2,
      scope: "q2",
      due: 4,
    });
  });
  it("연도를 바꾸면 연간으로", () => {
    expect(withYear(2025, TODAY)).toEqual({
      year: 2025,
      quarter: 0,
      scope: "year",
      due: 1,
    });
  });
  it("주소 왕복 + 잘못된 값은 기본값", () => {
    const p = parseDashboardParams(
      {
        year: "2026",
        quarter: "3",
        unit: "quarter",
        tab: "year",
        scope: "m8",
        due: "8",
      },
      TODAY,
    );
    expect(
      parseDashboardParams(
        Object.fromEntries(new URL(`http://x${dashboardHref(p)}`).searchParams),
        TODAY,
      ),
    ).toEqual(p);
    expect(
      parseDashboardParams(
        { year: "abc", quarter: "9", scope: "m13", tab: "x" },
        TODAY,
      ),
    ).toMatchObject({ year: 2026, quarter: 0, scope: "year", tab: "month" });
  });
});
