import { describe, expect, it } from "vitest";

import {
  allocateQuarterTargets,
  computeAnnualProgress,
  computeTargets,
} from "./targets";
import { financeMonth } from "./test-fixtures";
import type { AnnualTargetInput } from "./types";

const target = (
  revenueTarget: bigint,
  quarterTargets: AnnualTargetInput["quarterTargets"] = [
    null,
    null,
    null,
    null,
  ],
): AnnualTargetInput => ({ year: 2026, revenueTarget, quarterTargets });

describe("allocateQuarterTargets", () => {
  it("모두 비어 있으면 연간 ÷ 4", () => {
    expect(allocateQuarterTargets(target(2_800n)).quarters).toEqual([
      700n,
      700n,
      700n,
      700n,
    ]);
  });

  it("나누어떨어지지 않으면 나머지 원은 마지막 빈 분기에", () => {
    // 2024 시드와 같은 경우: 4분기만 입력 → (2200 − 600) ÷ 3 = 533 나머지 1
    const result = allocateQuarterTargets(
      target(2_200n, [null, null, null, 600n]),
    );
    expect(result.quarters).toEqual([533n, 533n, 534n, 600n]);
    expect(result.sources).toEqual([
      "allocated",
      "allocated",
      "allocated",
      "input",
    ]);
    expect(result.warning).toBeUndefined();
  });

  it("4개 모두 입력: 그대로, 합계가 다르면 경고", () => {
    expect(
      allocateQuarterTargets(target(2_400n, [500n, 600n, 600n, 700n])).warning,
    ).toBeUndefined();
    expect(
      allocateQuarterTargets(target(2_500n, [500n, 600n, 600n, 700n])).warning,
    ).toBe("QUARTER_SUM_MISMATCH");
  });

  it("입력한 분기 합이 연간보다 크면 빈 분기는 0 + 경고", () => {
    const result = allocateQuarterTargets(
      target(1_000n, [800n, 500n, null, null]),
    );
    expect(result.quarters).toEqual([800n, 500n, 0n, 0n]);
    expect(result.warning).toBe("QUARTER_SUM_EXCEEDS_ANNUAL");
  });
});

describe("computeTargets", () => {
  // 1~9월 각 100 매출, 9월은 DRAFT
  const months = Array.from({ length: 9 }, (_, i) =>
    financeMonth(2026, i + 1, {
      productSales: 100n,
      status: i + 1 === 9 ? "DRAFT" : "CONFIRMED",
    }),
  );
  const t = target(2_400n); // 분기 600

  it("목표 미설정이면 null", () => {
    expect(
      computeTargets({ unit: "quarter", year: 2026, quarter: 3 }, null, months),
    ).toEqual({
      annual: null,
      period: null,
      quarterTargets: null,
    });
  });

  it("분기: 분기 목표 대비 (DRAFT 제외), 연간: 1월~기간 끝 확정 매출", () => {
    const result = computeTargets(
      { unit: "quarter", year: 2026, quarter: 3 },
      t,
      months,
    );
    expect(result.period).toEqual({
      kind: "quarter",
      target: 600n,
      actual: 200n,
      rate: 200 / 600,
    });
    expect(result.annual).toEqual({
      target: 2_400n,
      actual: 800n,
      rate: 800 / 2400,
    });
  });

  it("월: 분기 목표 대비 분기 첫 달~해당 월 누적", () => {
    const result = computeTargets(
      { unit: "month", year: 2026, month: 8 },
      t,
      months,
    );
    expect(result.period).toEqual({
      kind: "quarter-progress",
      target: 600n,
      actual: 200n,
      rate: 200 / 600,
    });
  });

  it("연간 / YTD(경과월 비례 목표)", () => {
    const year = computeTargets({ unit: "year", year: 2026 }, t, months);
    expect(year.period?.kind).toBe("annual");
    expect(year.period?.actual).toBe(800n);

    const ytd = computeTargets(
      { unit: "ytd", year: 2026, month: 6 },
      t,
      months,
    );
    expect(ytd.period).toEqual({
      kind: "ytd-prorated",
      target: 1_200n,
      actual: 600n,
      rate: 0.5,
    });
    expect(ytd.annual?.actual).toBe(600n);
  });

  it("다른 연도 데이터는 섞이지 않는다", () => {
    const withLastYear = [
      ...months,
      financeMonth(2025, 8, { productSales: 999n }),
    ];
    expect(
      computeTargets(
        { unit: "quarter", year: 2026, quarter: 3 },
        t,
        withLastYear,
      ).period?.actual,
    ).toBe(200n);
  });
});

describe("computeAnnualProgress (연간 목표 도넛)", () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
  // 1~9월 각 100, 9월 DRAFT
  const months = Array.from({ length: 9 }, (_, i) =>
    financeMonth(2026, i + 1, {
      productSales: 100n,
      status: i + 1 === 9 ? "DRAFT" : "CONFIRMED",
    }),
  );
  const t = target(2_400n);

  it("선택 기간과 무관하게 그 해 확정 월 전부 + 경과율(이번 달 전까지)", () => {
    expect(computeAnnualProgress(2026, t, months, d("2026-10-16"))).toEqual({
      year: 2026,
      target: 2_400n,
      actual: 800n,
      remaining: 1_600n,
      rate: 800 / 2400,
      elapsedMonths: 9,
      elapsedRatio: 0.75,
      confirmedMonths: [1, 2, 3, 4, 5, 6, 7, 8],
    });
  });

  it("지난해는 경과율 100%, 미래 연도는 0%", () => {
    const lastYear = { ...t, year: 2025 };
    expect(
      computeAnnualProgress(2025, lastYear, [], d("2026-10-16"))?.elapsedRatio,
    ).toBe(1);
    const nextYear = { ...t, year: 2027 };
    expect(
      computeAnnualProgress(2027, nextYear, [], d("2026-10-16"))?.elapsedRatio,
    ).toBe(0);
  });

  it("초과 달성이면 남은 금액 0, 목표 없으면 null", () => {
    const big = Array.from({ length: 12 }, (_, i) =>
      financeMonth(2026, i + 1, { productSales: 300n }),
    );
    expect(
      computeAnnualProgress(2026, t, big, d("2027-01-05"))?.remaining,
    ).toBe(0n);
    expect(
      computeAnnualProgress(2026, null, months, d("2026-10-16")),
    ).toBeNull();
  });
});
