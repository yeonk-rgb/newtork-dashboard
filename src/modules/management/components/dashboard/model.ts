// 경영 대시보드(메인) 새 구성의 표시 모델 (순수 함수, 2026-10-25 담당자 요청)
// 상단 KPI 4개 / 분기별 목표 달성 현황(목표매출 달성률·매출 구성·지출 구성) / 추이 및 분석(산업 분야별·제품별 매출)
// 숫자는 모두 summary 에 이미 있는 값을 그대로 옮긴다 (새 계산 없음 — model.test.ts 가 같은 값인지 고정)
// 이름은 labels.ts 한 곳 (metrics 이름표는 그대로)
import { formatWonShort } from "@/shared/format/money";
import {
  monthIndex,
  periodMonths,
  quarterOf,
  type Period,
} from "@/shared/period/period";
import { toPeriodParam } from "@/shared/period/url";
import {
  EXPENSE_COLORS,
  METER,
  PALETTE,
  type MeterColors,
} from "@/shared/ui/chart-colors";
import type { DonutSlice } from "@/shared/ui/donut-data";

import type { Comparison, ManagementSummary } from "../../metrics/types";
import {
  progressSlices,
  revenueDonut,
  type DonutCardData,
} from "../donuts/donut-cards";
import { COMPARISON_LABELS, DASHBOARD_LABELS as L } from "./labels";
import { TERMS } from "../../terms";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const s = (v: bigint) => v.toString();
const NO_DATA = "이 기간에 확정된 데이터가 없습니다.";

// ---------- 비교 줄 ----------

export type DeltaRow<T> = {
  label: string;
  value: T | null;
  reason?: string;
  /** 비교 기간에 미확정 월이 섞임 (참고용 * 표시) */
  partial: boolean;
};

/** 월·분기: 직전 기간 + 전년 동기 / 연간·누적: 직전 기간(= 전년)만 — 지금 대시보드와 같은 규칙 */
export function deltaRows<T>(
  summary: ManagementSummary,
  pick: (c: Comparison) => { value: T | null; reason?: string },
): DeltaRow<T>[] {
  const { period, changes } = summary;
  const rows: DeltaRow<T>[] = [
    {
      label: COMPARISON_LABELS.previous[period.unit],
      ...pick(changes.previous),
      partial: changes.previous.isPartial,
    },
  ];
  if (period.unit === "month" || period.unit === "quarter") {
    rows.push({
      label: COMPARISON_LABELS.lastYear,
      ...pick(changes.lastYear),
      partial: changes.lastYear.isPartial,
    });
  }
  return rows;
}

// ---------- 상단 KPI 4개 ----------

export type KpiModel = {
  key: "revenue" | "expense" | "profit" | "receivables";
  title: string;
  value: bigint;
  /** 빨간색 (적자) */
  warn: boolean;
  /** 숫자 아래 한 줄 */
  sub: string | null;
  /** 작은 안내 */
  note: string | null;
  /** 매출·지출 = 증감률, 추정 이익 = 금액 차이, 미수금 = 없음(잔액이라 비교하지 않음) */
  deltas:
    | { kind: "rate"; rows: DeltaRow<number>[] }
    | { kind: "amount"; rows: DeltaRow<bigint>[] }
    | null;
  /** 값 대신 "-"와 이 글을 보여 줌 (미수금: 기간 안에 경영지원 관리 외상매출금 입력이 없음) */
  emptyText?: string;
  /** 미수금 아래 목록 (장기 미수금 = 빨강) */
  details?: { label: string; amount: bigint; count: number; warn: boolean }[];
  /** BEP 달성률 한 줄 (추정 이익 카드) — 상세로 옮긴 BEP 카드로 가는 연결 */
  link?: { label: string; href: string };
};

function bepLine(summary: ManagementSummary): KpiModel["link"] {
  const b = summary.breakEven;
  if (b.rate === null && b.reason !== "not-reachable") return undefined;
  const value = b.reason === "not-reachable" ? "도달 불가" : pct(b.rate!);
  return {
    label: `BEP 달성률 ${value}`,
    href: `/management?period=${toPeriodParam(summary.period)}#break-even`,
  };
}

export function dashboardKpis(summary: ManagementSummary): KpiModel[] {
  const { revenue, expenses, profit, receivables, confirmation } = summary;
  const months = periodMonths(summary.period).length;
  return [
    {
      key: "revenue",
      title: L.kpi.revenue,
      value: revenue.total,
      warn: false,
      sub: `확정 ${confirmation.confirmedMonths.length}개월 / ${months}개월`,
      note: null,
      deltas: {
        kind: "rate",
        rows: deltaRows(summary, (c) => ({
          value: c.revenue.rate,
          reason: c.revenue.reason,
        })),
      },
    },
    {
      key: "expense",
      title: L.kpi.expense,
      value: expenses.total,
      warn: false,
      sub: null,
      note: L.expenseNote,
      deltas: {
        kind: "rate",
        rows: deltaRows(summary, (c) => ({
          value: c.expense.rate,
          reason: c.expense.reason,
        })),
      },
    },
    {
      key: "profit",
      title: L.kpi.profit,
      value: profit.profit,
      warn: profit.profit < 0n,
      sub: !confirmation.hasData
        ? null
        : profit.profit < 0n
          ? `적자 · 이익률 ${profit.margin === null ? "-" : pct(profit.margin)}`
          : `이익률 ${profit.margin === null ? "-" : pct(profit.margin)}`,
      note: L.profitNote[profit.costMode],
      deltas: {
        kind: "amount",
        rows: deltaRows(summary, (c) => ({
          value: c.profitDiff.diff,
          reason: c.profitDiff.reason,
        })),
      },
      link: bepLine(summary),
    },
    {
      key: "receivables",
      title: receivables.month
        ? `${L.kpi.receivables} (${receivables.month.month}월 ${TERMS.arBasis})`
        : L.kpi.receivables,
      value: receivables.total,
      warn: false,
      sub: `거래처 ${receivables.customerCount}곳${receivables.isCurrentMonth ? ` · ${L.receivablesInProgress}` : ""}`,
      note: L.receivablesBasis,
      ...(receivables.month ? {} : { emptyText: L.receivablesEmpty }),
      deltas: null,
      details: receivables.month
        ? [
            {
              label: L.longOverdue,
              amount: receivables.longOverdue.amount,
              count: receivables.longOverdue.count,
              warn: receivables.longOverdue.amount > 0n,
            },
            {
              label: L.scheduled,
              amount: receivables.scheduled.amount,
              count: receivables.scheduled.count,
              warn: false,
            },
          ]
        : undefined,
      link: {
        label: "전체 보기",
        href: `/management?period=${toPeriodParam(summary.period)}#receivables`,
      },
    },
  ];
}

// ---------- 분기별 목표 달성 현황 ----------

export type QuarterRow = {
  quarter: 1 | 2 | 3 | 4;
  target: bigint;
  actual: bigint;
  rate: number | null;
  /** input = 직접 입력, allocated = 자동 배분 */
  source: "input" | "allocated";
  /** ended = 끝난 분기, current = 오늘이 속한 분기, future = 아직 */
  state: "ended" | "current" | "future";
  /** 그 분기 달 중 확정 안 된 달 (끝난 분기여도 실적이 다 들어오지 않음) */
  unconfirmedMonths: number[];
  /**
   * 분기에 확정된 달이 하나도 없을 때 금액·달성률(0.0%) 대신 보여 줄 글 — 엑셀(목표 대비 실적·월별 리포트)과 같은 문장 (2026-10-26)
   * 진행 중 "진행 중 (경과 1/3개월, 확정된 달 없음)" / 끝남 "(7·8·9월 미확정, 확정된 달 없음)" / 그 밖에는 null
   */
  noConfirmedText: string | null;
  /** 끝났고 3개월 모두 확정인데 목표 미달 → 빨강 (확정 안 된 달이 있으면 빨강 대신 "미확정" 안내) */
  warn: boolean;
  /** 지금 보고 있는 기간의 분기 */
  selected: boolean;
};

export type TargetCardModel = {
  title: string;
  donut: DonutCardData;
  /** 가운데 아래 한 줄: 목표·실적 */
  summaryLine: string | null;
  /** 월 보기: "월 목표 = 분기 목표 ÷ 3 (자동)" */
  note: string | null;
  /** 월 보기: 그 분기 진행률 한 줄 */
  quarterProgress: {
    label: string;
    target: bigint;
    actual: bigint;
    rate: number | null;
  } | null;
  quarters: QuarterRow[];
  /** 연간 진도 한 줄 (연간 보기에서는 가운데가 연간이라 null) */
  annual: {
    rate: number | null;
    elapsedRatio: number;
    /** 실적률 − 경과율 (양수 = 앞섬) */
    gap: number;
  } | null;
};

const EMPTY_TARGET = (year: number): DonutCardData => ({
  slices: [],
  center: { value: "-", label: "" },
  emptyText: `${year}년 목표가 설정되지 않았습니다. 목표·항목 설정에서 입력하세요.`,
});

function quarterState(
  year: number,
  quarter: number,
  today: Date,
): QuarterRow["state"] {
  const now = monthIndex({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
  });
  const first = monthIndex({ year, month: (quarter - 1) * 3 + 1 });
  if (now < first) return "future";
  if (now <= first + 2) return "current";
  return "ended";
}

function centerLabel(period: Period): string {
  switch (period.unit) {
    case "month":
      return `${period.month}월 달성률`;
    case "quarter":
      return `${period.quarter}분기 달성률`;
    case "year":
      return `${period.year}년 달성률`;
    case "ytd":
      return `1~${period.month}월 진도율`;
  }
}

/**
 * 목표매출 달성률 카드 — 가운데: 월 보기 = 그 달(월 목표 = 분기 ÷ 3 자동) / 분기 = 그 분기 / 연간 = 연간 / 누적 = 진도율
 * @param today 한국 날짜 (getTodayKst) — 끝난 분기 판단
 * @param meter 강조 카드(코퍼 바탕)이면 METER_ON_ACCENT
 */
export function targetCardModel(
  summary: ManagementSummary,
  today: Date,
  meter: MeterColors = METER,
): TargetCardModel {
  const { period, targets, annualProgress } = summary;
  const current = period.unit === "month" ? targets.month : targets.period;
  const base: Omit<TargetCardModel, "donut" | "summaryLine"> = {
    title: L.targetCard,
    note: period.unit === "month" ? L.monthTargetNote : null,
    quarterProgress: null,
    quarters: [],
    annual: null,
  };
  if (!current || current.target === 0n || !targets.quarterTargets) {
    return { ...base, donut: EMPTY_TARGET(period.year), summaryLine: null };
  }

  const selectedQuarter =
    period.unit === "quarter"
      ? period.quarter
      : period.unit === "month"
        ? quarterOf(period.month)
        : null;
  const quarters: QuarterRow[] = targets.quarterTargets.quarters.map(
    (target, i) => {
      const quarter = (i + 1) as QuarterRow["quarter"];
      const actual = targets.quarterActuals?.[i] ?? 0n;
      const rate = target === 0n ? null : Number(actual) / Number(target);
      const state = quarterState(period.year, quarter, today);
      const confirmed = annualProgress?.confirmedMonths ?? [];
      const quarterMonths = [1, 2, 3].map((k) => (quarter - 1) * 3 + k);
      const unconfirmedMonths =
        state === "ended"
          ? quarterMonths.filter((m) => !confirmed.includes(m))
          : [];
      const confirmedCount = quarterMonths.filter((m) =>
        confirmed.includes(m),
      ).length;
      const thisMonth = monthIndex({
        year: today.getUTCFullYear(),
        month: today.getUTCMonth() + 1,
      });
      const elapsed =
        thisMonth -
        monthIndex({ year: period.year, month: quarterMonths[0] }) +
        1;
      const noConfirmedText =
        confirmedCount > 0
          ? null
          : state === "current"
            ? `진행 중 (경과 ${elapsed}/3개월, 확정된 달 없음)`
            : state === "ended"
              ? `(${unconfirmedMonths.join("·")}월 미확정, 확정된 달 없음)`
              : null;
      return {
        quarter,
        target,
        actual,
        rate,
        source: targets.quarterTargets!.sources[i],
        state,
        unconfirmedMonths,
        noConfirmedText,
        warn:
          state === "ended" &&
          unconfirmedMonths.length === 0 &&
          rate !== null &&
          rate < 1,
        selected: quarter === selectedQuarter,
      };
    },
  );

  const quarterProgress =
    period.unit === "month" && targets.period
      ? {
          label: `${quarterOf(period.month)}분기 진행률 (${(quarterOf(period.month) - 1) * 3 + 1}~${period.month}월)`,
          target: targets.period.target,
          actual: targets.period.actual,
          rate: targets.period.rate,
        }
      : null;

  const annual =
    period.unit !== "year" && annualProgress
      ? {
          rate: annualProgress.rate,
          elapsedRatio: annualProgress.elapsedRatio,
          gap: (annualProgress.rate ?? 0) - annualProgress.elapsedRatio,
        }
      : null;

  return {
    ...base,
    donut: {
      slices: progressSlices(current.target, current.actual, meter),
      ratioBase: s(current.target),
      center: {
        value: current.rate === null ? "-" : pct(current.rate),
        label: centerLabel(period),
      },
      emptyText: null,
    },
    summaryLine: `목표 ${formatWonShort(current.target)} · 실적 ${formatWonShort(current.actual)}`,
    quarterProgress,
    quarters,
    annual,
  };
}

/** 매출 구성 도넛 — 기존 revenueDonut 와 같은 값, 조각 이름만 화면 이름 표로 */
export function revenueMixDonut(summary: ManagementSummary): DonutCardData {
  const donut = revenueDonut(summary);
  return {
    ...donut,
    slices: donut.slices.map((slice) => ({
      ...slice,
      label:
        L.revenueSlices[slice.key as keyof typeof L.revenueSlices] ??
        slice.label,
    })),
  };
}

/** 지출 구성: 조각 4개(상품 매입·원재료 매입·경비·기타) + "기타" 펼침용 항목별 금액 */
export type ExpenseMixModel = {
  donut: DonutCardData;
  /** 조각 이름 옆 작은 글씨 (key → 글) */
  sliceHints: Record<string, string>;
  /** [항목별 보기 ▾] — 그 외 지출 항목별 금액 (합 = 기타 조각) */
  otherItems: { key: string; label: string; amount: string }[];
};

const EXPENSE_KEYS = [
  "goodsPurchase",
  "materialPurchase",
  "operatingExpense",
  "otherExpense",
] as const;

export function expenseMixDonut(summary: ManagementSummary): ExpenseMixModel {
  const { expenses } = summary;
  const amountOf = (key: string) =>
    expenses.items.find((i) => i.key === key)?.amount ?? 0n;
  const slices: DonutSlice[] = EXPENSE_KEYS.map((key) => ({
    key,
    label: L.expenseSlices[key],
    value: s(amountOf(key)),
    color: EXPENSE_COLORS[key] ?? PALETTE.slate,
  }));
  return {
    donut: {
      slices,
      ratioBase: s(expenses.total),
      center: { value: formatWonShort(expenses.total), label: "총지출" },
      emptyText:
        !summary.confirmation.hasData || expenses.total === 0n ? NO_DATA : null,
    },
    sliceHints: { otherExpense: L.otherExpenseHint },
    otherItems: expenses.otherItems.map((i) => ({
      key: i.key,
      label: i.label,
      amount: s(i.amount),
    })),
  };
}

// ---------- 추이 및 분석: 산업 분야별·제품별 매출 ----------

export type ShareInput = {
  source: "mock" | "production";
  items: { key: string; label: string; amount: bigint; quantity: number }[];
};

export type ShareDonutModel = {
  title: string;
  /** "샘플 데이터" (생산팀 연동 전) */
  badge: string | null;
  note: string | null;
  /** 기준 안내 (제품별 매출 = "제품 시리즈 기준") */
  basis: string;
  /** 범례: 금액 먼저 → 비중 % (담당자 요청) */
  legend: "amount-first";
  donut: DonutCardData;
};

/**
 * 산업 분야별·제품별 매출 도넛 (목업이면 합계는 이 기간 확정 매출로 맞춘 값 — alignMockToTotal 뒤에 넣는다)
 * 조각은 고정 순서(색 인접 검증 순서), 목록은 금액 큰 순 — 지금 대시보드와 같은 규칙
 */
export function shareDonutModel(
  kind: "industry" | "series",
  share: ShareInput,
  revenueTotal: bigint,
  order: string[],
  colors: Record<string, string>,
): ShareDonutModel {
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i < 0 ? order.length : i;
  };
  const mock = share.source === "mock";
  return {
    title: kind === "industry" ? L.industry : L.series,
    badge: mock ? L.sampleBadge : null,
    note: mock ? L.sampleNote : null,
    basis: kind === "series" ? L.seriesBasis : L.industryBasis,
    legend: "amount-first",
    donut: {
      slices: [...share.items]
        .sort((a, b) => rank(a.key) - rank(b.key))
        .map((i) => ({
          key: i.key,
          label: i.label,
          value: s(i.amount),
          color: colors[i.key] ?? PALETTE.slate,
          extra: `${i.quantity.toLocaleString("ko-KR")}대`,
        })),
      center: { value: formatWonShort(revenueTotal), label: "합계" },
      emptyText: revenueTotal === 0n ? NO_DATA : null,
    },
  };
}
