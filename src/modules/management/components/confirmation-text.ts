// 미확정 월 안내 문구 (순수 함수 — 테스트용으로 분리)
import type { YearMonth } from "@/shared/period/period";

import type { Period } from "@/shared/period/period";

import type { Comparison, Confirmation } from "../metrics/types";

/** [7, 8] → "7~8월", [7, 9] → "7·9월", 연도가 섞이면 "2025년 12월·2026년 1월" */
export function monthsText(months: YearMonth[]): string {
  if (months.length === 0) return "";
  const sameYear = months.every((m) => m.year === months[0].year);
  if (!sameYear) {
    return months.map((m) => `${m.year}년 ${m.month}월`).join("·");
  }
  const nums = months.map((m) => m.month);
  const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  if (contiguous && nums.length > 1) return `${nums[0]}~${nums.at(-1)}월`;
  return `${nums.join("·")}월`;
}

export type ConfirmationNotice = {
  tone: "warning" | "info";
  message: string;
} | null;

export function confirmationNotice(c: Confirmation): ConfirmationNotice {
  const unconfirmed = monthsText(c.unconfirmedMonths);
  const confirmed = monthsText(c.confirmedMonths);
  const pending = monthsText(c.pendingMonths);

  if (c.unconfirmedMonths.length > 0) {
    if (!c.hasData) {
      return {
        tone: "warning",
        message: `${unconfirmed}이 아직 확정되지 않아 집계할 데이터가 없습니다.`,
      };
    }
    return {
      tone: "warning",
      message: `${unconfirmed}이 아직 확정되지 않아 ${confirmed}만 집계되었습니다. 증감은 비교 기간도 같은 월끼리 맞춰 계산했습니다.`,
    };
  }
  if (c.pendingMonths.length > 0) {
    return {
      tone: "info",
      message: c.hasData
        ? `${pending}은 아직 마감 전이라 ${confirmed}만 집계되었습니다. 증감은 같은 월끼리 맞춰 계산했습니다.`
        : `${pending}은 아직 마감 전이라 집계할 데이터가 없습니다.`,
    };
  }
  return null;
}

/** 같은 월끼리 비교한 범위: 월 번호가 같으면 "1~8월끼리", 다르면 "7~8월↔4~5월" */
export function alignedText(
  aligned: NonNullable<Comparison["aligned"]>,
): string {
  const same = aligned.current.every(
    (m, i) => m.month === aligned.base[i]?.month,
  );
  return same
    ? `${monthsText(aligned.current.map((m) => ({ year: 0, month: m.month })))}끼리`
    : `${monthsText(aligned.current)}↔${monthsText(aligned.base)}`;
}

/**
 * KPI·상세 표에 작게 표시할 비교 범위 안내.
 * 예) "같은 기간 비교 · 전분기 7~8월↔4~5월 · 전년 동기 7~8월끼리" / 모두 전체 비교면 null
 */
export function comparisonNote(
  period: Period,
  changes: { previous: Comparison; lastYear: Comparison },
): string | null {
  const previousName =
    period.unit === "month"
      ? "전월"
      : period.unit === "quarter"
        ? "전분기"
        : "전년";
  const parts: string[] = [];
  if (changes.previous.aligned) {
    parts.push(`${previousName} ${alignedText(changes.previous.aligned)}`);
  }
  if (
    (period.unit === "month" || period.unit === "quarter") &&
    changes.lastYear.aligned
  ) {
    parts.push(`전년 동기 ${alignedText(changes.lastYear.aligned)}`);
  }
  return parts.length > 0 ? `같은 기간 비교 · ${parts.join(" · ")}` : null;
}
