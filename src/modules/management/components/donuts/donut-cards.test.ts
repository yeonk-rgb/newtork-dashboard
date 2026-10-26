import { describe, expect, it } from "vitest";

import { donutCsv, donutRows, listRows } from "@/shared/ui/donut-data";

import { computeManagementSummary } from "../../metrics/summary";
import { arEntry, date, financeMonth } from "../../metrics/test-fixtures";
import {
  annualTargetDonut,
  bepDonut,
  periodTargetDonut,
  profitDonut,
  receivablesDonut,
  revenueDonut,
} from "./donut-cards";

const q3 = { unit: "quarter", year: 2026, quarter: 3 } as const;

function summaryFor(
  opts: {
    target?: bigint | null;
    sales?: bigint;
    opex?: bigint;
    draftSep?: boolean;
  } = {},
) {
  const sales = opts.sales ?? 200_000_000n;
  const month = (m: number) =>
    financeMonth(2026, m, {
      productSales: sales,
      goodsSales: sales / 10n,
      serviceSales: sales / 20n,
      goodsPurchase: 10_000_000n,
      materialPurchase: 40_000_000n,
      operatingExpense: opts.opex ?? 30_000_000n,
      status: m === 9 && opts.draftSep ? "DRAFT" : "CONFIRMED",
    });
  return computeManagementSummary({
    period: q3,
    financeMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(month),
    annualTarget:
      opts.target === null
        ? null
        : {
            year: 2026,
            revenueTarget: opts.target ?? 4_000_000_000n,
            quarterTargets: [null, null, null, null],
          },
    // 9월 경영지원 관리 외상매출금
    receivables: [
      arEntry("a", { amount: 30_000_000n }),
      arEntry("b", { amount: 20_000_000n }),
      arEntry("c", { status: "LONG_OVERDUE", amount: 50_000_000n }),
      arEntry("d", { status: "LONG_OVERDUE", amount: 10_000_000n }),
      arEntry("e", { status: "COLLECTED", amount: 7_000_000n }),
    ],
    today: date("2026-10-21"),
  });
}

describe("매출 구성 도넛", () => {
  it("제품·상품·용역, 가운데 총매출", () => {
    const d = revenueDonut(summaryFor());
    expect(d.slices.map((x) => x.label)).toEqual([
      "제품 매출",
      "상품 매출",
      "용역 매출",
    ]);
    expect(d.center).toEqual({ value: "6.90억원", label: "총매출" });
    const rows = donutRows(d.slices);
    expect(rows.map((r) => r.ratio.toFixed(3))).toEqual([
      "0.870",
      "0.087",
      "0.043",
    ]);
  });

  it("확정 데이터 없으면 빈 안내", () => {
    const empty = computeManagementSummary({
      period: q3,
      financeMonths: [],
      annualTarget: null,
      receivables: [],
      today: date("2026-10-21"),
    });
    expect(revenueDonut(empty).emptyText).toBe(
      "이 기간에 확정된 데이터가 없습니다.",
    );
  });
});

describe("목표 달성 도넛", () => {
  it("미달: 실적·남은 목표, 비율은 목표 대비, 가운데 달성률", () => {
    // 분기 목표 10억, 실적 6.9억
    const d = periodTargetDonut(summaryFor());
    expect(d.slices.map((x) => [x.key, x.value])).toEqual([
      ["actual", "690000000"],
      ["remaining", "310000000"],
    ]);
    expect(d.center).toEqual({ value: "69.0%", label: "목표 달성률" });
    expect(
      donutRows(d.slices, d.ratioBase).map((r) => r.ratio.toFixed(3)),
    ).toEqual(["0.690", "0.310"]);
  });

  it("초과: 목표 달성분·초과분 — 초과분 % 는 목표 대비", () => {
    const d = periodTargetDonut(summaryFor({ target: 2_000_000_000n }));
    expect(d.slices.map((x) => x.key)).toEqual(["actual", "over"]);
    const rows = donutRows(d.slices, d.ratioBase);
    expect(rows.map((r) => r.ratio.toFixed(2))).toEqual(["1.00", "0.38"]);
    expect(d.center.value).toBe("138.0%");
  });

  it("목표 없음: 안내", () => {
    expect(periodTargetDonut(summaryFor({ target: null })).emptyText).toContain(
      "목표가 설정되지 않았습니다",
    );
  });

  it("연간 목표: 진도 눈금(경과율) 포함", () => {
    const d = annualTargetDonut(summaryFor());
    expect(d.marker).toEqual({ ratio: 0.75, label: "연간 경과율 75.0%" });
    expect(d.center.label).toBe("연간 달성률");
  });
});

describe("이익 구조 도넛", () => {
  it("매입·경비·이익, 매출 대비 비율, 가운데 이익률", () => {
    const d = profitDonut(summaryFor());
    expect(d.slices.map((x) => x.key)).toEqual([
      "purchase",
      "operating",
      "profit",
    ]);
    const rows = donutRows(d.slices, d.ratioBase);
    const total = rows.reduce((n, r) => n + r.ratio, 0);
    expect(total).toBeCloseTo(1, 6); // 매입 + 경비 + 이익 = 매출
    expect(d.center.label).toBe("이익률");
  });

  it("적자면 이익 조각 없이 매입·경비만, 가운데 '이익률 (적자)'", () => {
    const d = profitDonut(summaryFor({ sales: 10_000_000n }));
    expect(d.slices.map((x) => x.key)).toEqual(["purchase", "operating"]);
    expect(d.center.label).toBe("이익률 (적자)");
    expect(d.center.value.startsWith("-")).toBe(true);
  });
});

describe("미수금 도넛", () => {
  it("장기 미수금 · 당월 수금예정 + 건수, 가운데 미수 총액·기준월", () => {
    const d = receivablesDonut(summaryFor());
    expect(d.slices.map((x) => [x.label, x.value, x.extra])).toEqual([
      ["장기 미수금", "60000000", "2건"],
      ["당월 수금예정", "50000000", "2건"],
    ]);
    // 당월 수금(700만)는 미수가 아니라 조각·가운데 합계에 넣지 않음
    expect(d.center).toEqual({
      value: "1.10억원",
      label: "미수금 총액 (9월 외상매출금 기준)",
    });
  });

  it("기간에 경영지원 관리 외상매출금 입력이 없으면 빈 안내", () => {
    const s = summaryFor();
    const d = receivablesDonut({
      ...s,
      receivables: { ...s.receivables, month: null },
    });
    expect(d.slices).toEqual([]);
    expect(d.emptyText).toMatch("입력이 없습니다");
  });
});

describe("도넛 공통 계산", () => {
  const rows = donutRows([
    { key: "a", label: "작은", value: "10", color: "#000" },
    {
      key: "b",
      label: '큰, "따옴표"',
      value: "30",
      color: "#000",
      extra: "3건",
    },
  ]);

  it("목록 순서: 조각 순서 / 값 큰 순", () => {
    expect(listRows(rows, "slice").map((r) => r.key)).toEqual(["a", "b"]);
    expect(listRows(rows, "value").map((r) => r.key)).toEqual(["b", "a"]);
  });

  it("CSV: BOM, 쉼표·따옴표 이스케이프, 원 단위 정수, 비율", () => {
    const csv = donutCsv(rows, "금액(원)", "건수");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "항목,금액(원),비율(%),건수",
      "작은,10,25.0,",
      '"큰, ""따옴표""",30,75.0,3건',
      "",
    ]);
  });

  it("합계 0 이면 비율 0 (0으로 나누지 않음)", () => {
    expect(
      donutRows([{ key: "z", label: "z", value: "0", color: "#000" }])[0].ratio,
    ).toBe(0);
  });
});

describe("손익분기점(BEP) 도넛", () => {
  // 분기 3개월: 월 매출 = sales × 1.15, 변동비(매입) 월 5천만, 고정비(경비) = opex
  it("100% 미만: 실제 매출 / BEP까지 남은 매출, 비율은 BEP 매출 대비", () => {
    const s = summaryFor({ sales: 60_000_000n });
    const d = bepDonut(s);
    const b = s.breakEven;
    expect(b.rate).toBeLessThan(1);
    expect(d.slices.map((x) => [x.key, x.label, x.value])).toEqual([
      ["actual", "실제 매출", b.revenue.toString()],
      [
        "remaining",
        "BEP까지 남은 매출",
        (b.bepRevenue! - b.revenue).toString(),
      ],
    ]);
    expect(d.ratioBase).toBe(b.bepRevenue!.toString());
    expect(d.center).toEqual({
      value: `${(b.rate! * 100).toFixed(1)}%`,
      label: "BEP 달성률",
    });
    expect(d.emptyText).toBeNull();
  });

  it("100% 이상: BEP 매출 / BEP 초과 매출", () => {
    const s = summaryFor();
    const d = bepDonut(s);
    expect(s.breakEven.rate).toBeGreaterThan(1);
    expect(d.slices.map((x) => x.label)).toEqual(["BEP 매출", "BEP 초과 매출"]);
    expect(d.center.value).toBe("600.0%");
  });

  it("도달 불가(변동비 ≥ 매출): 가운데 '도달 불가', 변동비 한 조각(매출 대비)", () => {
    const s = summaryFor({ sales: 40_000_000n });
    const d = bepDonut(s);
    expect(s.breakEven.reason).toBe("not-reachable");
    expect(d.center).toEqual({ value: "도달 불가", label: "BEP 달성률" });
    expect(d.slices).toHaveLength(1);
    expect(d.ratioBase).toBe(s.breakEven.revenue.toString());
    const [row] = donutRows(d.slices, d.ratioBase);
    expect(row.ratio).toBeGreaterThan(1);
  });

  it.each([
    [{ opex: 0n }, "고정비가 0원이라 손익분기점이 없습니다"],
    [{ sales: 0n }, "매출이 없어 손익분기점을 계산할 수 없습니다"],
  ])("계산할 수 없으면 그래프 대신 안내 (%o)", (opts, text) => {
    const d = bepDonut(summaryFor(opts));
    expect(d.slices).toEqual([]);
    expect(d.emptyText).toContain(text);
  });
});
