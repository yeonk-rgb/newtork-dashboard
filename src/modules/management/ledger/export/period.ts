// 채권·채무 엑셀 다운로드 — 기간·시트 구성·파일 이름 (순수 함수)
// 기간 형식은 대시보드와 같은 toPeriodParam: 당월 "2026-10" / 분기 "2026-Q4" / 연간 "2026" (누적 YTD 는 받지 않음)
import {
  monthIndex,
  periodMonths,
  type Period,
  type YearMonth,
} from "@/shared/period/period";
import { parsePeriodParam, toPeriodParam } from "@/shared/period/url";

import { formatLedgerMonth, monthOfDate, type LedgerRow } from "../rules";
import type { ExportSheet } from "./build-ledger-workbook";

export type ExportPeriod = Exclude<Period, { unit: "ytd" }>;

export function parseExportPeriod(value: string | null): ExportPeriod | null {
  const period = parsePeriodParam(value);
  return period && period.unit !== "ytd" ? period : null;
}

/** 기간 안의 달 중 이번 달까지 (미래 달 제외) */
export function exportMonths(period: ExportPeriod, today: string): YearMonth[] {
  const limit = monthIndex(monthOfDate(today));
  return periodMonths(period).filter((ym) => monthIndex(ym) <= limit);
}

/**
 * 시트 구성 (2026-10-25 결정)
 * - 당월: 그 달 시트 1장 (데이터가 없어도 빈 양식 모양)
 * - 분기·연간: 데이터가 있는 달만 월별 시트, 하나도 없으면 빈 양식 1장 (시트 이름 = 기간 "2026-Q4")
 */
export function planExportSheets(
  period: ExportPeriod,
  months: YearMonth[],
  rowsOf: (ym: YearMonth) => LedgerRow[],
): ExportSheet[] {
  const sheets = months.map((ym) => ({
    sheetName: formatLedgerMonth(ym),
    month: formatLedgerMonth(ym),
    rows: rowsOf(ym),
  }));
  if (period.unit === "month") return sheets;
  const withData = sheets.filter((s) => s.rows.length > 0);
  if (withData.length > 0) return withData;
  const name = toPeriodParam(period);
  return [{ sheetName: name, month: name, rows: [] }];
}

/** 경영지원_관리_2026-10.xlsx (분기 _2026-Q4, 연간 _2026) + 영문 대체 이름 */
export function exportFileName(period: ExportPeriod): {
  fileName: string;
  asciiName: string;
} {
  const param = toPeriodParam(period);
  return {
    fileName: `경영지원_관리_${param}.xlsx`,
    asciiName: `ledger-${param}.xlsx`,
  };
}

/** 화면 [엑셀 다운로드] 메뉴: 보고 있는 기준년월의 당월·분기·연간 */
export function exportPeriodsFor(month: YearMonth): {
  label: string;
  param: string;
}[] {
  const quarter = Math.ceil(month.month / 3) as 1 | 2 | 3 | 4;
  const periods: [string, ExportPeriod][] = [
    ["당월", { unit: "month", year: month.year, month: month.month }],
    ["분기", { unit: "quarter", year: month.year, quarter }],
    ["연간", { unit: "year", year: month.year }],
  ];
  return periods.map(([label, p]) => ({ label, param: toPeriodParam(p) }));
}
