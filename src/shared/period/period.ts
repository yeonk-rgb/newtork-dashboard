// 조회 기간 — 팀 공통 형식 (docs/interface-production.md, docs/integration-notes.md)
// 회계연도는 1~12월로 가정 (docs/05-open-questions.md 2번 확인 전)

export type Quarter = 1 | 2 | 3 | 4;

export type Period =
  | { unit: "month"; year: number; month: number } // month: 1~12
  | { unit: "quarter"; year: number; quarter: Quarter }
  | { unit: "year"; year: number }
  | { unit: "ytd"; year: number; month: number }; // 연초 누적: 1월 ~ month

export type YearMonth = { year: number; month: number };

function assertMonth(month: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`월은 1~12 사이여야 합니다: ${month}`);
  }
}

export function quarterOf(month: number): Quarter {
  assertMonth(month);
  return Math.ceil(month / 3) as Quarter;
}

/** 월 순서 비교용 정수 (2026-09 → 2026*12+8) */
export function monthIndex({ year, month }: YearMonth): number {
  return year * 12 + (month - 1);
}

export function fromMonthIndex(index: number): YearMonth {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  return fromMonthIndex(monthIndex(ym) + delta);
}

function range(from: YearMonth, to: YearMonth): YearMonth[] {
  const result: YearMonth[] = [];
  for (let i = monthIndex(from); i <= monthIndex(to); i++) {
    result.push(fromMonthIndex(i));
  }
  return result;
}

/** 기간에 포함된 월 목록 (오름차순) */
export function periodMonths(period: Period): YearMonth[] {
  const { year } = period;
  switch (period.unit) {
    case "month":
      assertMonth(period.month);
      return [{ year, month: period.month }];
    case "quarter": {
      const first = (period.quarter - 1) * 3 + 1;
      return range({ year, month: first }, { year, month: first + 2 });
    }
    case "year":
      return range({ year, month: 1 }, { year, month: 12 });
    case "ytd":
      assertMonth(period.month);
      return range({ year, month: 1 }, { year, month: period.month });
  }
}

/** 직전 기간: 전월 / 전분기 / 전년 / (YTD는 전년 같은 범위) */
export function previousPeriod(period: Period): Period {
  switch (period.unit) {
    case "month": {
      const prev = addMonths(period, -1);
      return { unit: "month", ...prev };
    }
    case "quarter":
      return period.quarter === 1
        ? { unit: "quarter", year: period.year - 1, quarter: 4 }
        : {
            unit: "quarter",
            year: period.year,
            quarter: (period.quarter - 1) as Quarter,
          };
    case "year":
      return { unit: "year", year: period.year - 1 };
    case "ytd":
      return { ...period, year: period.year - 1 };
  }
}

/** 전년 동기 */
export function samePeriodLastYear(period: Period): Period {
  return { ...period, year: period.year - 1 };
}

/** 기간 마지막 날 (UTC 자정) */
export function periodEndDate(period: Period): Date {
  const last = periodMonths(period).at(-1)!;
  return new Date(Date.UTC(last.year, last.month, 0));
}

export function periodLabel(period: Period): string {
  switch (period.unit) {
    case "month":
      return `${period.year}년 ${period.month}월`;
    case "quarter":
      return `${period.year}년 ${period.quarter}분기`;
    case "year":
      return `${period.year}년`;
    case "ytd":
      return `${period.year}년 1~${period.month}월 누적`;
  }
}

export function yearMonthLabel({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
