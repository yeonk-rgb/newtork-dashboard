// URL ?period= 값 ↔ Period
//   2026-Q3 (분기) / 2026-09 (월) / 2026 (연간) / 2026-YTD09 (연초 누적)
import type { Period, Quarter } from "./period";

const pad = (month: number) => String(month).padStart(2, "0");

export function toPeriodParam(period: Period): string {
  switch (period.unit) {
    case "quarter":
      return `${period.year}-Q${period.quarter}`;
    case "month":
      return `${period.year}-${pad(period.month)}`;
    case "year":
      return `${period.year}`;
    case "ytd":
      return `${period.year}-YTD${pad(period.month)}`;
  }
}

const validYear = (year: number) => year >= 2000 && year <= 2100;
const validMonth = (month: number) => month >= 1 && month <= 12;

/** 잘못된 값이면 null */
export function parsePeriodParam(
  value: string | null | undefined,
): Period | null {
  if (!value) return null;
  const match = /^(\d{4})(?:-(?:Q([1-4])|(\d{2})|YTD(\d{2})))?$/i.exec(
    value.trim(),
  );
  if (!match) return null;

  const year = Number(match[1]);
  if (!validYear(year)) return null;
  const [, , quarter, month, ytd] = match;

  if (quarter)
    return { unit: "quarter", year, quarter: Number(quarter) as Quarter };
  if (month) {
    const m = Number(month);
    return validMonth(m) ? { unit: "month", year, month: m } : null;
  }
  if (ytd) {
    const m = Number(ytd);
    return validMonth(m) ? { unit: "ytd", year, month: m } : null;
  }
  return { unit: "year", year };
}

/** 이미 끝난 분기 중 가장 최근 분기 (기본 기간) */
export function lastCompletedQuarter(today: Date): Period {
  const year = today.getUTCFullYear();
  const current = Math.ceil((today.getUTCMonth() + 1) / 3);
  return current === 1
    ? { unit: "quarter", year: year - 1, quarter: 4 }
    : { unit: "quarter", year, quarter: (current - 1) as Quarter };
}
