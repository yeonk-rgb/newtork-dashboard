// 미확정 월 안내 문구 (순수 함수 — 테스트용으로 분리)
import type { YearMonth } from "@/shared/period/period";

import type { Confirmation } from "../metrics/types";

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
      message: `${unconfirmed}이 아직 확정되지 않아 ${confirmed}만 집계되었습니다. 비교 수치는 참고용입니다.`,
    };
  }
  if (c.pendingMonths.length > 0) {
    return {
      tone: "info",
      message: c.hasData
        ? `${pending}은 아직 마감 전이라 ${confirmed}만 집계되었습니다.`
        : `${pending}은 아직 마감 전이라 집계할 데이터가 없습니다.`,
    };
  }
  return null;
}
