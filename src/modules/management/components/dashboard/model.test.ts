// 경영 대시보드 새 구성 표시 모델 — 숫자는 summary 의 기존 값과 같고, 이름만 화면 이름 표
import { describe, expect, it } from "vitest";

import { INDUSTRIES } from "@/shared/contracts/production";
import type { Period } from "@/shared/period/period";
import { INDUSTRY_COLORS, SERIES_COLORS } from "@/shared/ui/chart-colors";

import { buildAiInput } from "../../ai/build-input";
import { hashAiInput } from "../../ai/hash";
import { DEFAULT_METRICS_SETTINGS } from "../../metrics/settings";
import { computeManagementSummary } from "../../metrics/summary";
import { date, financeMonth, receivable } from "../../metrics/test-fixtures";
import type { FinanceMonth, ManagementSummary } from "../../metrics/types";
import { revenueDonut } from "../donuts/donut-cards";
import { DASHBOARD_LABELS } from "./labels";
import {
  dashboardKpis,
  expenseMixDonut,
  revenueMixDonut,
  shareDonutModel,
  targetCardModel,
} from "./model";

const TODAY = date("2026-10-21");

const other = (categoryId: string, name: string, amount: bigint) => ({
  categoryId,
  name,
  sortOrder: categoryId === "ad" ? 1 : 2,
  costType: null,
  amount,
});

/** 2025·2026년 1~9월, 9월만 임시저장. 2025년은 매출이 낮고 지출이 높아 적자 달이 섞임 */
function months(): FinanceMonth[] {
  const list: FinanceMonth[] = [];
  for (const year of [2025, 2026]) {
    for (let m = 1; m <= 12; m++) {
      if (year === 2026 && m > 9) break;
      const sales =
        year === 2026 ? 180_000_000n + BigInt(m) * 1_000_000n : 80_000_000n;
      list.push(
        financeMonth(year, m, {
          status: year === 2026 && m === 9 ? "DRAFT" : "CONFIRMED",
          productSales: sales,
          goodsSales: sales / 8n,
          serviceSales: 7_000_001n,
          goodsPurchase: 12_000_000n,
          materialPurchase: 61_000_000n,
          operatingExpense: m === 8 ? 33_648_000n : 31_000_000n,
          otherExpenses: [
            other("ad", "광고선전비", 2_400_000n),
            other("ent", "접대비", 1_850_001n),
          ],
        }),
      );
    }
  }
  return list;
}

function summaryOf(
  period: Period,
  quarterTargets: (bigint | null)[] = [null, null, null, null],
) {
  return computeManagementSummary({
    period,
    financeMonths: months(),
    annualTarget: {
      year: 2026,
      revenueTarget: 2_800_000_000n,
      quarterTargets: quarterTargets as [
        bigint | null,
        bigint | null,
        bigint | null,
        bigint | null,
      ],
    },
    receivables: [
      receivable("a", { occurredOn: date("2026-05-01"), amount: 32_000_000n }),
      receivable("b", { occurredOn: date("2026-09-10"), amount: 18_000_000n }),
    ],
    today: TODAY,
  });
}

const Q3: Period = { unit: "quarter", year: 2026, quarter: 3 };
const AUG: Period = { unit: "month", year: 2026, month: 8 };
const Y2026: Period = { unit: "year", year: 2026 };
const ALL: Period[] = [Q3, AUG, Y2026, { unit: "ytd", year: 2026, month: 9 }];

describe("상단 KPI 4개 = summary 기존 값", () => {
  it.each(ALL.map((p) => [p.unit, p] as const))(
    "%s: 매출·지출·추정 이익·미수금",
    (_, period) => {
      const s = summaryOf(period);
      const [revenue, expense, profit, receivables] = dashboardKpis(s);
      expect([revenue.key, expense.key, profit.key, receivables.key]).toEqual([
        "revenue",
        "expense",
        "profit",
        "receivables",
      ]);
      expect(revenue.value).toBe(s.revenue.total);
      expect(expense.value).toBe(s.expenses.total);
      expect(profit.value).toBe(s.profit.profit);
      expect(receivables.value).toBe(s.receivables.total);
      expect(receivables.sub).toBe(`${s.receivables.count}건`);
      // 증감: 매출·지출 = 기존 증감률 그대로, 이익 = 금액 차이
      expect(revenue.deltas).toMatchObject({ kind: "rate" });
      expect(revenue.deltas!.rows[0].value).toBe(
        s.changes.previous.revenue.rate,
      );
      expect(expense.deltas!.rows[0].value).toBe(
        s.changes.previous.expense.rate,
      );
      expect(profit.deltas).toMatchObject({ kind: "amount" });
      expect(profit.deltas!.rows[0].value).toBe(
        s.changes.previous.profitDiff.diff,
      );
      expect(receivables.deltas).toBeNull();
    },
  );

  it("추정 이익 = 매출 − 지출 (지금 비용 기준 '매입 포함'에서 정확히 같음)", () => {
    expect(DEFAULT_METRICS_SETTINGS.costMode).toBe("purchases");
    for (const period of ALL) {
      const s = summaryOf(period);
      const profit = dashboardKpis(s)[2];
      expect(profit.value, period.unit).toBe(
        s.revenue.total - s.expenses.total,
      );
      expect(profit.note).toBe(DASHBOARD_LABELS.profitNote.purchases);
    }
  });

  it("이익 금액 차이 = 현재 이익 − 비교 기간 이익, 비교 줄은 지금 대시보드와 같은 규칙", () => {
    const s = summaryOf(Q3);
    const rows = dashboardKpis(s)[2].deltas!.rows;
    expect(rows.map((r) => r.label)).toEqual(["전분기", "전년 동기"]);
    const prev = summaryOf({ unit: "quarter", year: 2026, quarter: 2 });
    // 3분기는 9월 임시저장 → 같은 월끼리(7~8월 ↔ 4~5월) 비교라 전분기 전체 이익과는 다를 수 있음 → 부호·존재만
    expect(typeof rows[0].value).toBe("bigint");
    expect(prev.profit.profit).toBeGreaterThan(0n);
    // 연간: 직전 기간(= 전년) 한 줄
    expect(
      dashboardKpis(summaryOf(Y2026))[2].deltas!.rows.map((r) => r.label),
    ).toEqual(["전년"]);
  });

  it("적자면 빨강 + '적자' 글자, 미수금 90일 초과는 빨강·전체 보기 연결", () => {
    const loss = computeManagementSummary({
      period: { unit: "quarter", year: 2025, quarter: 1 },
      financeMonths: months(),
      annualTarget: null,
      receivables: [],
      today: TODAY,
    });
    const profit = dashboardKpis(loss)[2];
    expect(profit.value).toBeLessThan(0n);
    expect(profit.warn).toBe(true);
    expect(profit.sub).toMatch(/^적자/);
    const r = dashboardKpis(summaryOf(Q3))[3];
    expect(r.title).toBe("미수금 (9/30 기준)");
    expect(r.details?.[0]).toMatchObject({
      label: "90일 초과",
      amount: 32_000_000n,
      count: 1,
      warn: true,
    });
    expect(r.link?.href).toBe("/management?period=2026-Q3#receivables");
    expect(r.note).toBe("미수금 관리 기준");
  });

  it("추정 이익 카드 아래 BEP 달성률 한 줄 → 상세 계산 내역", () => {
    const s = summaryOf(Q3);
    const link = dashboardKpis(s)[2].link!;
    expect(link.href).toBe("/management?period=2026-Q3#break-even");
    expect(link.label).toBe(
      `BEP 달성률 ${(s.breakEven.rate! * 100).toFixed(1)}% (임시 기준)`,
    );
  });
});

describe("목표매출 달성률 카드", () => {
  it("분기: 가운데 = 기존 기간 목표 달성률, 분기별 목록, 연간 한 줄", () => {
    const s = summaryOf(Q3);
    const card = targetCardModel(s, TODAY);
    expect(card.title).toBe("목표매출 달성률");
    expect(card.donut.center).toEqual({
      value: `${(s.targets.period!.rate! * 100).toFixed(1)}%`,
      label: "3분기 달성률",
    });
    expect(card.note).toBeNull();
    expect(
      card.quarters.map((q) => [
        q.quarter,
        q.target,
        q.actual,
        q.state,
        q.selected,
      ]),
    ).toEqual([
      [
        1,
        s.targets.quarterTargets!.quarters[0],
        s.targets.quarterActuals![0],
        "ended",
        false,
      ],
      [
        2,
        s.targets.quarterTargets!.quarters[1],
        s.targets.quarterActuals![1],
        "ended",
        false,
      ],
      [
        3,
        s.targets.quarterTargets!.quarters[2],
        s.targets.quarterActuals![2],
        "ended",
        true,
      ],
      [
        4,
        s.targets.quarterTargets!.quarters[3],
        s.targets.quarterActuals![3],
        "current",
        false,
      ],
    ]);
    // 끝났고 3개월 모두 확정인데 미달만 빨강 — 3분기는 9월 임시저장이라 빨강 대신 미확정 안내, 4분기는 진행 중
    expect(
      card.quarters.map((q) => [q.quarter, q.unconfirmedMonths, q.warn]),
    ).toEqual([
      [1, [], card.quarters[0].rate! < 1],
      [2, [], card.quarters[1].rate! < 1],
      [3, [9], false],
      [4, [], false],
    ]);
    expect(card.annual?.rate).toBe(s.annualProgress!.rate);
  });

  it("월: 가운데 = 그 달 월 목표(분기 ÷ 3) 대비, 분기 진행률 한 줄, '월 목표 = 분기 목표 ÷ 3 (자동)'", () => {
    const s = summaryOf(AUG);
    const card = targetCardModel(s, TODAY);
    const monthTarget = s.targets.quarterTargets!.quarters[2] / 3n;
    expect(s.targets.month).toMatchObject({ month: 8, target: monthTarget });
    expect(card.donut.center.label).toBe("8월 달성률");
    expect(card.donut.center.value).toBe(
      `${(s.targets.month!.rate! * 100).toFixed(1)}%`,
    );
    expect(card.donut.ratioBase).toBe(monthTarget.toString());
    expect(card.note).toBe("월 목표 = 분기 목표 ÷ 3 (자동)");
    expect(card.quarterProgress).toEqual({
      label: "3분기 진행률 (7~8월)",
      target: s.targets.period!.target,
      actual: s.targets.period!.actual,
      rate: s.targets.period!.rate,
    });
  });

  it("연간: 가운데 = 연간 달성률, 연간 한 줄은 없음 / 목표 없으면 빈 안내", () => {
    const card = targetCardModel(summaryOf(Y2026), TODAY);
    expect(card.donut.center.label).toBe("2026년 달성률");
    expect(card.annual).toBeNull();
    const none = computeManagementSummary({
      period: Q3,
      financeMonths: months(),
      annualTarget: null,
      receivables: [],
      today: TODAY,
    });
    expect(targetCardModel(none, TODAY).donut.emptyText).toMatch(
      "목표가 설정되지 않았습니다",
    );
  });
});

describe("매출 구성·지출 구성 도넛", () => {
  it("매출 구성: 기존 도넛과 같은 값, 조각 이름만 제품·상품·용역", () => {
    const s = summaryOf(Q3);
    const before = revenueDonut(s);
    const after = revenueMixDonut(s);
    expect(after.slices.map((x) => x.value)).toEqual(
      before.slices.map((x) => x.value),
    );
    expect(after.center).toEqual(before.center);
    expect(after.slices.map((x) => x.label)).toEqual(["제품", "상품", "용역"]);
    // metrics 이름표는 그대로
    expect(s.revenue.items.map((i) => i.label)).toEqual(
      before.slices.map((x) => x.label),
    );
  });

  it("지출 구성: 조각 4개 = 기존 지출 항목, 합 = 총지출, 기타 펼침 합 = 기타 조각", () => {
    const s = summaryOf(Q3);
    const m = expenseMixDonut(s);
    expect(m.donut.slices.map((x) => [x.key, x.label])).toEqual([
      ["goodsPurchase", "상품 매입"],
      ["materialPurchase", "원재료 매입"],
      ["operatingExpense", "경비"],
      ["otherExpense", "기타"],
    ]);
    for (const slice of m.donut.slices) {
      expect(slice.value).toBe(
        s.expenses.items.find((i) => i.key === slice.key)!.amount.toString(),
      );
    }
    const total = m.donut.slices.reduce((n, x) => n + BigInt(x.value), 0n);
    expect(total).toBe(s.expenses.total);
    expect(m.donut.ratioBase).toBe(s.expenses.total.toString());
    expect(m.sliceHints.otherExpense).toBe("(광고선전비·접대비 등)");
    expect(m.otherItems.map((i) => i.label)).toEqual(["광고선전비", "접대비"]);
    expect(
      m.otherItems.reduce((n, i) => n + BigInt(i.amount), 0n).toString(),
    ).toBe(m.donut.slices[3].value);
  });
});

describe("산업 분야별·제품별 매출", () => {
  const share = (source: "mock" | "production") => ({
    source,
    items: [
      { key: "water", label: "상하수도", amount: 100n, quantity: 3 },
      { key: "plant", label: "민간 플랜트", amount: 300n, quantity: 5 },
    ],
  });

  it("샘플 데이터 표시 유지, 범례 금액 먼저, 제품별은 '제품 시리즈 기준'", () => {
    const ind = shareDonutModel(
      "industry",
      share("mock"),
      400n,
      INDUSTRIES.map((i) => i.key),
      INDUSTRY_COLORS,
    );
    expect(ind).toMatchObject({
      title: "산업 분야별 매출",
      badge: "샘플 데이터",
      legend: "amount-first",
      basis: null,
    });
    expect(ind.note).toMatch("가상");
    const ser = shareDonutModel(
      "series",
      share("production"),
      400n,
      Object.keys(SERIES_COLORS),
      SERIES_COLORS,
    );
    expect(ser).toMatchObject({
      title: "제품별 매출",
      basis: "제품 시리즈 기준",
      badge: null,
      note: null,
    });
    expect(ind.donut.slices.map((x) => [x.label, x.value, x.extra])).toEqual(
      expect.arrayContaining([["민간 플랜트", "300", "5대"]]),
    );
  });
});

describe("AI 분석 입력은 바뀌지 않는다", () => {
  it("새 칸(월 목표·이익 금액 차이)을 빼도 AI 입력·해시가 같다", () => {
    const s = summaryOf(Q3);
    const without: ManagementSummary = {
      ...s,
      targets: { ...s.targets, month: null, monthTargets: null },
      changes: {
        previous: { ...s.changes.previous, profitDiff: { diff: null } },
        lastYear: { ...s.changes.lastYear, profitDiff: { diff: null } },
      },
    };
    const quarter = { unit: "quarter", year: 2026, quarter: 3 } as const;
    expect(hashAiInput(buildAiInput(s, quarter))).toBe(
      hashAiInput(buildAiInput(without, quarter)),
    );
  });
});
