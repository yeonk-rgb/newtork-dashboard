import { describe, expect, it } from "vitest";

import {
  exportFileName,
  exportMenuPeriods,
  monthsUpTo,
  parseExportPeriod,
  periodMemoLabel,
  periodSheetName,
  periodTotalSuffix,
} from "./period";

const ENTRY = { ko: "월간입력", ascii: "entry" };

describe("기간 표기", () => {
  it("시트 이름·메모·합계 제목 — 연초 누적만 시트 이름이 '2026-01~10'", () => {
    const cases = [
      ["2026-10", "2026-10", "당월", null],
      ["2026-Q3", "2026-Q3", "3분기", "(2026년 3분기 합계)"],
      ["2026", "2026", "2026년", "(2026년 합계)"],
      ["2026-YTD10", "2026-01~10", "1~10월", "(2026년 1~10월 합계)"],
    ] as const;
    for (const [param, sheet, memo, suffix] of cases) {
      const p = parseExportPeriod(param)!;
      expect([
        periodSheetName(p),
        periodMemoLabel(p),
        periodTotalSuffix(p),
      ]).toEqual([sheet, memo, suffix]);
    }
    expect(parseExportPeriod("2026-13")).toBeNull();
    expect(parseExportPeriod(null)).toBeNull();
  });

  it("파일 이름은 채권·채무와 같은 규칙 (경영지원_{화면}_{기간}.xlsx) + 영문 대체 이름", () => {
    expect(exportFileName(ENTRY, parseExportPeriod("2026-Q3")!)).toEqual({
      fileName: "경영지원_월간입력_2026-Q3.xlsx",
      asciiName: "entry-2026-Q3.xlsx",
    });
    expect(exportFileName(ENTRY, parseExportPeriod("2026-YTD10")!)).toEqual({
      fileName: "경영지원_월간입력_2026-01~10.xlsx",
      asciiName: "entry-2026-YTD10.xlsx",
    });
  });

  it("미래 달은 빼고 이번 달까지", () => {
    expect(
      monthsUpTo(parseExportPeriod("2026-Q4")!, { year: 2026, month: 10 }),
    ).toEqual([{ year: 2026, month: 10 }]);
    expect(
      monthsUpTo(parseExportPeriod("2026-11")!, { year: 2026, month: 10 }),
    ).toEqual([]);
  });

  it("메뉴: 당월·분기·연간·연초 누적 (1월은 누적 = 당월이라 뺌)", () => {
    expect(
      exportMenuPeriods({ year: 2026, month: 9 }).map((p) => p.label),
    ).toEqual(["당월", "분기", "연간", "연초 누적 (1~9월)"]);
    expect(exportMenuPeriods({ year: 2026, month: 1 })).toHaveLength(3);
  });
});
