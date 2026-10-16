import { describe, expect, it } from "vitest";

import type { Confirmation } from "../metrics/types";
import {
  alignedText,
  comparisonNote,
  confirmationNotice,
  monthsText,
} from "./confirmation-text";

const ym = (year: number, month: number) => ({ year, month });

describe("monthsText", () => {
  it("연속 / 띄엄 / 연도 섞임", () => {
    expect(monthsText([ym(2026, 9)])).toBe("9월");
    expect(monthsText([ym(2026, 7), ym(2026, 8)])).toBe("7~8월");
    expect(monthsText([ym(2026, 1), ym(2026, 2), ym(2026, 3)])).toBe("1~3월");
    expect(monthsText([ym(2026, 7), ym(2026, 9)])).toBe("7·9월");
    expect(monthsText([ym(2025, 12), ym(2026, 1)])).toBe(
      "2025년 12월·2026년 1월",
    );
  });
});

const base: Confirmation = {
  confirmedMonths: [],
  unconfirmedMonths: [],
  pendingMonths: [],
  isPartial: false,
  hasData: false,
};

describe("confirmationNotice", () => {
  it("미확정 월이 있으면 경고 (요청 문구)", () => {
    expect(
      confirmationNotice({
        ...base,
        confirmedMonths: [ym(2026, 7), ym(2026, 8)],
        unconfirmedMonths: [{ ...ym(2026, 9), reason: "DRAFT" }],
        isPartial: true,
        hasData: true,
      }),
    ).toEqual({
      tone: "warning",
      message:
        "9월이 아직 확정되지 않아 7~8월만 집계되었습니다. 증감은 비교 기간도 같은 월끼리 맞춰 계산했습니다.",
    });
  });

  it("확정 데이터가 하나도 없으면", () => {
    expect(
      confirmationNotice({
        ...base,
        unconfirmedMonths: [{ ...ym(2026, 9), reason: "DRAFT" }],
        isPartial: true,
      })?.message,
    ).toBe("9월이 아직 확정되지 않아 집계할 데이터가 없습니다.");
  });

  it("마감 전 월만 있으면 안내(info)", () => {
    expect(
      confirmationNotice({
        ...base,
        pendingMonths: [ym(2026, 10), ym(2026, 11), ym(2026, 12)],
      }),
    ).toEqual({
      tone: "info",
      message: "10~12월은 아직 마감 전이라 집계할 데이터가 없습니다.",
    });
  });

  it("모두 확정이면 안내 없음", () => {
    expect(
      confirmationNotice({
        ...base,
        confirmedMonths: [ym(2026, 7)],
        hasData: true,
      }),
    ).toBeNull();
  });
});

describe("같은 기간 비교 안내", () => {
  const aligned = (cur: [number, number][], base: [number, number][]) => ({
    current: cur.map(([year, month]) => ({ year, month })),
    base: base.map(([year, month]) => ({ year, month })),
  });
  const cmp = (a: ReturnType<typeof aligned> | null) =>
    ({ aligned: a }) as unknown as Parameters<
      typeof comparisonNote
    >[1]["previous"];

  it("월 번호가 같으면 '끼리', 다르면 ↔", () => {
    expect(
      alignedText(
        aligned(
          [
            [2026, 1],
            [2026, 8],
          ],
          [
            [2025, 1],
            [2025, 8],
          ],
        ),
      ),
    ).toBe("1·8월끼리");
    expect(
      alignedText(
        aligned(
          [
            [2026, 7],
            [2026, 8],
          ],
          [
            [2026, 4],
            [2026, 5],
          ],
        ),
      ),
    ).toBe("7~8월↔4~5월");
  });

  it("분기: 전분기·전년 동기 함께, 연간: 전년만, 전체 비교면 null", () => {
    const q3 = { unit: "quarter", year: 2026, quarter: 3 } as const;
    expect(
      comparisonNote(q3, {
        previous: cmp(
          aligned(
            [
              [2026, 7],
              [2026, 8],
            ],
            [
              [2026, 4],
              [2026, 5],
            ],
          ),
        ),
        lastYear: cmp(
          aligned(
            [
              [2026, 7],
              [2026, 8],
            ],
            [
              [2025, 7],
              [2025, 8],
            ],
          ),
        ),
      }),
    ).toBe("같은 기간 비교 · 전분기 7~8월↔4~5월 · 전년 동기 7~8월끼리");

    const months18 = Array.from({ length: 8 }, (_, i) => i + 1);
    const y = aligned(
      months18.map((m) => [2026, m] as [number, number]),
      months18.map((m) => [2025, m] as [number, number]),
    );
    expect(
      comparisonNote(
        { unit: "year", year: 2026 },
        { previous: cmp(y), lastYear: cmp(y) },
      ),
    ).toBe("같은 기간 비교 · 전년 1~8월끼리");

    expect(
      comparisonNote(q3, { previous: cmp(null), lastYear: cmp(null) }),
    ).toBeNull();
  });
});
