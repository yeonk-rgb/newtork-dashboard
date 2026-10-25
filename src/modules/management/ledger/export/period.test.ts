import { describe, expect, it } from "vitest";

import {
  exportFileName,
  exportMonths,
  exportPeriodsFor,
  parseExportPeriod,
  planExportSheets,
} from "./period";
import { row } from "./test-rows";

describe("기간", () => {
  it("당월·분기·연간·연초 누적 (잘못된 값은 null)", () => {
    expect(parseExportPeriod("2026-10")).toEqual({
      unit: "month",
      year: 2026,
      month: 10,
    });
    expect(parseExportPeriod("2026-Q4")).toEqual({
      unit: "quarter",
      year: 2026,
      quarter: 4,
    });
    expect(parseExportPeriod("2026")).toEqual({ unit: "year", year: 2026 });
    expect(parseExportPeriod("2026-YTD09")).toEqual({
      unit: "ytd",
      year: 2026,
      month: 9,
    });
    expect(parseExportPeriod("abc")).toBeNull();
    expect(parseExportPeriod(null)).toBeNull();
  });

  it("미래 달은 뺀다", () => {
    const today = "2026-10-25";
    expect(
      exportMonths({ unit: "quarter", year: 2026, quarter: 4 }, today),
    ).toEqual([{ year: 2026, month: 10 }]);
    expect(exportMonths({ unit: "year", year: 2026 }, today)).toHaveLength(10);
    expect(
      exportMonths({ unit: "month", year: 2026, month: 11 }, today),
    ).toEqual([]);
  });
});

describe("시트 구성", () => {
  const months = [
    { year: 2026, month: 7 },
    { year: 2026, month: 8 },
    { year: 2026, month: 9 },
  ];
  const q3 = { unit: "quarter" as const, year: 2026, quarter: 3 as const };

  it("분기: 데이터 있는 달만", () => {
    const sheets = planExportSheets(q3, months, (ym) =>
      ym.month === 8 ? [row({ partnerName: "가(가상)", amount: "1" })] : [],
    );
    expect(sheets.map((s) => s.sheetName)).toEqual(["2026-08"]);
  });

  it("분기에 데이터가 하나도 없으면 빈 양식 1장 (시트 이름 = 기간)", () => {
    expect(
      planExportSheets(q3, months, () => []).map((s) => s.sheetName),
    ).toEqual(["2026-Q3"]);
  });

  it("당월은 데이터가 없어도 그 달 시트", () => {
    const sheets = planExportSheets(
      { unit: "month", year: 2026, month: 9 },
      [{ year: 2026, month: 9 }],
      () => [],
    );
    expect(sheets).toEqual([
      { sheetName: "2026-09", month: "2026-09", rows: [] },
    ]);
  });
});

describe("파일 이름·메뉴", () => {
  it("경영지원_관리_기간.xlsx + 영문 대체 이름", () => {
    expect(exportFileName({ unit: "month", year: 2026, month: 10 })).toEqual({
      fileName: "경영지원_관리_2026-10.xlsx",
      asciiName: "ledger-2026-10.xlsx",
    });
    expect(
      exportFileName({ unit: "quarter", year: 2026, quarter: 4 }).fileName,
    ).toBe("경영지원_관리_2026-Q4.xlsx");
    expect(exportFileName({ unit: "year", year: 2026 }).fileName).toBe(
      "경영지원_관리_2026.xlsx",
    );
  });

  it("보고 있는 기준년월 → 당월·분기·연간", () => {
    expect(exportPeriodsFor({ year: 2026, month: 10 })).toEqual([
      { label: "당월", param: "2026-10" },
      { label: "분기", param: "2026-Q4" },
      { label: "연간", param: "2026" },
      { label: "연초 누적 (1~10월)", param: "2026-YTD10" },
    ]);
    // 1월은 누적 = 당월이라 뺀다
    expect(exportPeriodsFor({ year: 2026, month: 1 })).toHaveLength(3);
  });
});
