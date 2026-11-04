// 경영 대시보드 새 구성 표시 모델 — 숫자는 summary 의 기존 값과 같고, 이름만 화면 이름 표
import { describe, expect, it } from "vitest";

import {
  INDUSTRIES,
  OTHER_SERIES_KEY,
  type SalesShareResult,
} from "@/shared/contracts/production";
import type { Period } from "@/shared/period/period";
import { INDUSTRY_COLORS, seriesColors } from "@/shared/ui/chart-colors";

import { buildAiInput } from "../../ai/build-input";
import { hashAiInput } from "../../ai/hash";
import { DEFAULT_METRICS_SETTINGS } from "../../metrics/settings";
import { computeManagementSummary } from "../../metrics/summary";
import { arEntry, date, financeMonth } from "../../metrics/test-fixtures";
import type { FinanceMonth, ManagementSummary } from "../../metrics/types";
import { revenueDonut } from "../donuts/donut-cards";
import { DASHBOARD_LABELS } from "./labels";
import {
  dashboardKpis,
  expenseMixDonut,
  productionCardModel,
  revenueMixDonut,
  serviceCardModel,
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
    // 경영지원 관리 외상매출금 8·9월 (2026-10-26부터 대시보드 미수금 기준)
    receivables: [8, 9].flatMap((month) => [
      arEntry(`a${month}`, {
        month,
        status: "LONG_OVERDUE",
        partnerName: "가나(가상)",
        amount: 32_000_000n,
      }),
      arEntry(`b${month}`, {
        month,
        partnerName: "다라(가상)",
        amount: 18_000_000n,
      }),
    ]),
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
      expect(receivables.sub).toBe(`거래처 ${s.receivables.customerCount}곳`);
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

  it("적자면 빨강 + '적자' 글자, 미수금 장기 미수금은 빨강·전체 보기 연결", () => {
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
    expect(r.title).toBe("미수금 (9월 외상매출금 기준)");
    expect(r.value).toBe(50_000_000n);
    expect(r.details).toEqual([
      { label: "장기 미수금", amount: 32_000_000n, count: 1, warn: true },
      { label: "당월 수금예정", amount: 18_000_000n, count: 1, warn: false },
    ]);
    expect(r.emptyText).toBeUndefined();
    expect(r.link?.href).toBe("/management?period=2026-Q3#receivables");
    expect(r.note).toBe("경영지원 관리 외상매출금 기준");
    // 기간에 경영지원 관리 입력이 없으면 "-" + 안내 (다른 기간 값을 끌어오지 않음)
    const none = dashboardKpis(loss)[3];
    expect(none.emptyText).toBe("이 기간에 경영지원 관리 입력 없음");
    expect(none.details).toBeUndefined();
  });

  it("추정 이익 카드 아래 BEP 달성률 한 줄 → 상세 계산 내역", () => {
    const s = summaryOf(Q3);
    const link = dashboardKpis(s)[2].link!;
    expect(link.href).toBe("/management?period=2026-Q3#break-even");
    expect(link.label).toBe(
      `BEP 달성률 ${(s.breakEven.rate! * 100).toFixed(1)}%`,
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

  it("확정된 달이 없는 분기: 0.0% 대신 엑셀과 같은 문장 (진행 중·끝남)", () => {
    const card = targetCardModel(summaryOf(Q3), TODAY);
    // 4분기: 10월 진행 중, 확정된 달 없음
    expect(card.quarters[3]).toMatchObject({
      state: "current",
      noConfirmedText: "진행 중 (경과 1/3개월, 확정된 달 없음)",
    });
    // 확정된 달이 있는 분기는 null (금액·달성률을 그대로 보여 줌)
    expect(card.quarters.slice(0, 3).map((q) => q.noConfirmedText)).toEqual([
      null,
      null,
      null,
    ]);
    // 3분기를 모두 임시저장으로 → 끝났지만 확정된 달 없음
    const draftQ3 = computeManagementSummary({
      period: Q3,
      financeMonths: months().map((m) =>
        m.year === 2026 && m.month >= 7
          ? { ...m, status: "DRAFT" as const }
          : m,
      ),
      annualTarget: {
        year: 2026,
        revenueTarget: 2_800_000_000n,
        quarterTargets: [null, null, null, null],
      },
      receivables: [],
      today: TODAY,
    });
    expect(targetCardModel(draftQ3, TODAY).quarters[2]).toMatchObject({
      state: "ended",
      noConfirmedText: "(7·8·9월 미확정, 확정된 달 없음)",
      warn: false,
    });
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

describe("산업 분야별·제품별 판매량 (생산팀 확정 출고 수량 기준)", () => {
  const share = (over: Partial<SalesShareResult> = {}): SalesShareResult => ({
    source: "production",
    basis: "quantity",
    items: [
      { key: "PRIVATE_PLANT", label: "민간 플랜트", amount: 0n, quantity: 5 },
      { key: "WATER", label: "상하수도", amount: 0n, quantity: 3 },
    ],
    unconfirmedRows: 0,
    unclassifiedQuantity: 0,
    hasSample: false,
    ...over,
  });
  const industryOf = (r: SalesShareResult) =>
    shareDonutModel(
      "industry",
      r,
      INDUSTRIES.map((i) => i.key),
      INDUSTRY_COLORS,
    );

  it("수량을 조각 값으로, 가운데는 확정 출고 합계, 조각은 분류 고정 순서", () => {
    const m = industryOf(share());
    expect(m).toMatchObject({
      title: "산업 분야별 판매량",
      valueKind: "count",
      badge: null,
      note: null,
      excluded: null,
      basis:
        "7개 분류(상하수도·발전소·가스·오일·석유·민간 플랜트·기타) · 확정 출고 수량",
    });
    expect(m.donut.center).toEqual({ value: "8대", label: "확정 출고" });
    expect(m.donut.slices.map((x) => [x.key, x.value, x.color])).toEqual([
      ["WATER", "3", INDUSTRY_COLORS.WATER],
      ["PRIVATE_PLANT", "5", INDUSTRY_COLORS.PRIVATE_PLANT],
    ]);
    expect(m.donut.emptyText).toBeNull();
  });

  it("수량 미확정·미분류는 조각에 넣지 않고 '제외' 안내, 시드 데이터면 샘플 배지", () => {
    const m = industryOf(
      share({ unconfirmedRows: 2, unclassifiedQuantity: 4, hasSample: true }),
    );
    expect(m.excluded).toBe("제외: 수량 미확정 2행 · 사업구분 미분류 4대");
    expect(m.badge).toBe("샘플 데이터");
    expect(m.note).toMatch("가짜");
  });

  it("확정 출고 수량이 없으면 빈 안내", () => {
    expect(industryOf(share({ items: [] })).donut.emptyText).toBe(
      DASHBOARD_LABELS.shareEmpty,
    );
  });

  it("제품별: 모델명 오름차순으로 팔레트 순서 색, 기타 모델은 맨 뒤 슬레이트", () => {
    const r = share({
      items: [
        { key: "02", label: "02", amount: 0n, quantity: 9 },
        {
          key: OTHER_SERIES_KEY,
          label: "기타 모델 2개",
          amount: 0n,
          quantity: 2,
        },
        { key: "01", label: "01", amount: 0n, quantity: 4 },
      ],
    });
    const palette = seriesColors(
      r.items.map((i) => i.key),
      OTHER_SERIES_KEY,
    );
    expect(palette.order).toEqual(["01", "02", OTHER_SERIES_KEY]);
    const m = shareDonutModel("series", r, palette.order, palette.colors);
    expect(m.title).toBe("제품별 판매량");
    expect(m.donut.slices.map((x) => x.key)).toEqual(palette.order);
    expect(new Set(m.donut.slices.map((x) => x.color)).size).toBe(3);
  });

  it("금액 기준(목업 형식)도 그대로 그린다 — 값은 원, 목록에 수량", () => {
    const m = industryOf(
      share({
        source: "mock",
        basis: "amount",
        items: [{ key: "WATER", label: "상하수도", amount: 300n, quantity: 5 }],
      }),
    );
    expect(m.valueKind).toBe("money");
    expect(m.badge).toBe("샘플 데이터");
    expect(m.donut.slices[0]).toMatchObject({ value: "300", extra: "5대" });
  });
});

describe("팀별 현황 카드", () => {
  it("생산: 확정 출고 수량·목표 달성률·납기 일정", () => {
    const m = productionCardModel({
      confirmedQuantity: 1234,
      target: 1500,
      targetNote: null,
      achievement: 1234 / 1500,
      shortfall: 266,
      unconfirmedRows: 3,
      dueEvents: 12,
      dueEventsPending: 2,
      hasSample: false,
    });
    expect(m.stats).toEqual([
      { label: "확정 출고 수량", value: "1,234대", hint: "목표 1,500대" },
      { label: "목표 달성률", value: "82.3%", hint: undefined },
      { label: "납기 일정", value: "12건", hint: "출고 대기 2건" },
    ]);
    expect(m.note).toBe("수량 미확정 3행은 실적에서 제외");
    expect(m.badge).toBeNull();
  });

  it("생산: 목표가 없으면 '-' + 이유", () => {
    const m = productionCardModel({
      confirmedQuantity: 0,
      target: null,
      targetNote: "월 목표 2/3개월만 입력",
      achievement: null,
      shortfall: null,
      unconfirmedRows: 0,
      dueEvents: 0,
      dueEventsPending: 0,
      hasSample: true,
    });
    expect(m.stats[1]).toEqual({
      label: "목표 달성률",
      value: "-",
      hint: "월 목표 2/3개월만 입력",
    });
    expect(m.note).toBeNull();
    expect(m.badge).toBe("샘플 데이터");
  });

  it("서비스: 출장 건수·유상 비율(미입력 제외)·수리 제품", () => {
    const m = serviceCardModel({
      trips: 10,
      paid: 6,
      free: 2,
      billingUnset: 2,
      paidRatio: 0.75,
      productQuantity: 14,
      topRegion: null,
      regionUnassigned: 0,
      topParts: [],
      hasSample: false,
    });
    expect(m.stats).toEqual([
      { label: "출장 건수", value: "10건" },
      { label: "유상 비율", value: "75.0%", hint: "유상 6 · 무상 2" },
      { label: "수리 제품", value: "14대" },
    ]);
    expect(m.note).toBe("비용청구 미입력 2건은 유상 비율에서 제외");
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
