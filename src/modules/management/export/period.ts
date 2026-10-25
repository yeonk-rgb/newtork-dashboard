// 경영지원 엑셀 다운로드 공용 — 기간·시트 이름·파일 이름·메모 문구 (순수 함수)
// 기간 형식은 대시보드와 같은 toPeriodParam: 당월 "2026-10" / 분기 "2026-Q3" / 연간 "2026" / 연초 누적 "2026-YTD10"
// 시트 이름·파일 이름의 기간은 사람이 읽는 모양: 연초 누적만 "2026-01~10" (나머지는 주소와 같음)
import {
  monthIndex,
  periodMonths,
  quarterOf,
  type Period,
  type YearMonth,
} from "@/shared/period/period";
import { parsePeriodParam, toPeriodParam } from "@/shared/period/url";

const pad = (n: number) => String(n).padStart(2, "0");

export function parseExportPeriod(value: string | null): Period | null {
  return parsePeriodParam(value);
}

/** 기간 안의 달 중 이번 달까지 (미래 달 제외) */
export function monthsUpTo(period: Period, thisMonth: YearMonth): YearMonth[] {
  const limit = monthIndex(thisMonth);
  return periodMonths(period).filter((ym) => monthIndex(ym) <= limit);
}

export const monthName = (ym: YearMonth) => `${ym.year}-${pad(ym.month)}`;

/** 시트 이름 = 기간: "2026-10" / "2026-Q3" / "2026" / "2026-01~10" */
export function periodSheetName(period: Period): string {
  return period.unit === "ytd"
    ? `${period.year}-01~${pad(period.month)}`
    : toPeriodParam(period);
}

/** H열 메모의 기간: "당월" / "3분기" / "2026년" / "1~10월" */
export function periodMemoLabel(period: Period): string {
  switch (period.unit) {
    case "month":
      return "당월";
    case "quarter":
      return `${period.quarter}분기`;
    case "year":
      return `${period.year}년`;
    case "ytd":
      return `1~${period.month}월`;
  }
}

/** 합계 시트 블록 제목 뒤 기간: "(2026년 3분기 합계)" / "(2026년 합계)" / "(2026년 1~10월 합계)" — 당월은 없음 */
export function periodTotalSuffix(period: Period): string | null {
  switch (period.unit) {
    case "month":
      return null;
    case "quarter":
      return `(${period.year}년 ${period.quarter}분기 합계)`;
    case "year":
      return `(${period.year}년 합계)`;
    case "ytd":
      return `(${period.year}년 1~${period.month}월 합계)`;
  }
}

/** 경영지원_{화면}_{기간}.xlsx (채권·채무 "경영지원_관리_2026-10.xlsx" 와 같은 규칙) + 영문 대체 이름 */
export function exportFileName(
  screen: { ko: string; ascii: string },
  period: Period,
): { fileName: string; asciiName: string } {
  return {
    fileName: `경영지원_${screen.ko}_${periodSheetName(period)}.xlsx`,
    asciiName: `${screen.ascii}-${toPeriodParam(period)}.xlsx`,
  };
}

/** 화면 [엑셀 다운로드] 메뉴: 보고 있는 달의 당월·분기·연간·연초 누적 (1월이면 누적 = 당월이라 뺀다) */
export function exportMenuPeriods(month: YearMonth): {
  label: string;
  period: Period;
}[] {
  const periods: { label: string; period: Period }[] = [
    { label: "당월", period: { unit: "month", ...month } },
    {
      label: "분기",
      period: {
        unit: "quarter",
        year: month.year,
        quarter: quarterOf(month.month),
      },
    },
    { label: "연간", period: { unit: "year", year: month.year } },
  ];
  if (month.month > 1) {
    periods.push({
      label: `연초 누적 (1~${month.month}월)`,
      period: { unit: "ytd", ...month },
    });
  }
  return periods;
}
