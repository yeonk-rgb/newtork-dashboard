// 경영 대시보드 도넛 7개의 데이터 (순수 함수): 조각·가운데 숫자·비율 분모·빈 상태 문구
// 금액은 정수 문자열로 넘기고(BigInt 직렬화), 표시는 DonutCard 가 한다
import { formatWonShort } from "@/shared/format/money";
import {
  AR_STATUS_COLORS,
  METER,
  PALETTE,
  PROFIT_COLORS,
  REVENUE_COLORS,
  type MeterColors,
} from "@/shared/ui/chart-colors";
import type { DonutSlice } from "@/shared/ui/donut-data";

import type { BreakEvenResult, ManagementSummary } from "../../metrics/types";
import { TERMS } from "../../terms";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const s = (v: bigint) => v.toString();

export type DonutCardData = {
  slices: DonutSlice[];
  ratioBase?: string;
  center: { value: string; label: string; title?: string };
  emptyText: string | null;
  marker?: { ratio: number; label: string };
};

const NO_DATA = "이 기간에 확정된 데이터가 없습니다.";

/** 분기 매출 구성: 제품·상품·용역 — 가운데 총매출 */
export function revenueDonut(summary: ManagementSummary): DonutCardData {
  const { revenue } = summary;
  return {
    slices: revenue.items.map((i) => ({
      key: i.key,
      label: i.label,
      value: s(i.amount),
      color: REVENUE_COLORS[i.key] ?? PALETTE.slate,
    })),
    center: { value: formatWonShort(revenue.total), label: "총매출" },
    emptyText:
      !summary.confirmation.hasData || revenue.total === 0n ? NO_DATA : null,
  };
}

type ProgressLabels = {
  actual: string;
  remaining: string;
  reached: string;
  over: string;
};
const TARGET_LABELS: ProgressLabels = {
  actual: "실적",
  remaining: "남은 목표",
  reached: "목표 달성분",
  over: "초과분",
};

/**
 * 목표 대비 실적 (분기·연간 공용): 실적 / 남은 목표, 초과면 목표 달성분 / 초과분 — 비율은 목표 대비
 * @param meter 색 (강조 카드 위에서는 METER_ON_ACCENT)
 */
export function progressSlices(
  target: bigint,
  actual: bigint,
  meter: MeterColors,
  labels: ProgressLabels = TARGET_LABELS,
): DonutSlice[] {
  if (actual <= target) {
    return [
      {
        key: "actual",
        label: labels.actual,
        value: s(actual),
        color: meter.fill,
      },
      {
        key: "remaining",
        label: labels.remaining,
        value: s(target - actual),
        color: meter.track,
        muted: true,
      },
    ];
  }
  return [
    {
      key: "actual",
      label: labels.reached,
      value: s(target),
      color: meter.fill,
    },
    {
      key: "over",
      label: labels.over,
      value: s(actual - target),
      color: meter.over,
    },
  ];
}

/** 기간 목표 달성률 (분기 보기면 분기 목표) */
export function periodTargetDonut(summary: ManagementSummary): DonutCardData {
  const t = summary.targets.period;
  if (!t || t.target === 0n) {
    return {
      slices: [],
      center: { value: "-", label: "" },
      emptyText: `${summary.period.year}년 목표가 설정되지 않았습니다. 목표·항목 설정에서 입력하세요.`,
    };
  }
  return {
    slices: progressSlices(t.target, t.actual, METER),
    ratioBase: s(t.target),
    center: {
      value: t.rate === null ? "-" : pct(t.rate),
      label: "목표 달성률",
    },
    emptyText: null,
  };
}

/**
 * 연간 목표 (선택 기간과 무관하게 그 해 기준) + 진도 눈금(경과율)
 * @param meter 색 — 메인 강조 카드(코퍼 바탕)에서는 METER_ON_ACCENT
 */
export function annualTargetDonut(
  summary: ManagementSummary,
  meter: MeterColors = METER,
): DonutCardData {
  const p = summary.annualProgress;
  if (!p || p.target === 0n) {
    return {
      slices: [],
      center: { value: "-", label: "" },
      emptyText: `${summary.period.year}년 목표가 설정되지 않았습니다. 목표·항목 설정에서 입력하세요.`,
    };
  }
  return {
    slices: progressSlices(p.target, p.actual, meter),
    ratioBase: s(p.target),
    center: {
      value: p.rate === null ? "-" : pct(p.rate),
      label: "연간 달성률",
    },
    emptyText: null,
    marker:
      p.elapsedRatio > 0 && p.elapsedRatio < 1
        ? { ratio: p.elapsedRatio, label: `연간 경과율 ${pct(p.elapsedRatio)}` }
        : undefined,
  };
}

/**
 * 미수금 총액 (경영지원 관리 외상매출금 기준, 2026-10-26): 장기 미수금 / 당월 수금예정 — 가운데 미수 총액, 목록에 행 수
 * 기준월이 없으면 "입력 없음"
 */
export function receivablesDonut(summary: ManagementSummary): DonutCardData {
  const r = summary.receivables;
  if (!r.month) {
    return {
      slices: [],
      center: { value: "-", label: "" },
      emptyText: `이 기간에 ${TERMS.ledger} 외상매출금 입력이 없습니다.`,
    };
  }
  const slices = [
    { key: "LONG_OVERDUE", label: TERMS.longOverdue, total: r.longOverdue },
    { key: "SCHEDULED", label: TERMS.scheduled, total: r.scheduled },
  ] as const;
  return {
    slices: slices.map(({ key, label, total }) => ({
      key,
      label,
      value: s(total.amount),
      color: AR_STATUS_COLORS[key],
      extra: `${total.count}건`,
    })),
    center: {
      value: formatWonShort(r.total),
      label: `미수금 총액 (${r.month.month}월 ${TERMS.arBasis})`,
    },
    emptyText:
      r.total === 0n
        ? `${r.month.month}월 ${TERMS.arBasis} 미수금이 없습니다.`
        : null,
  };
}

/**
 * 이익 구조: 매출 = 매입 + 경비 + 이익 — 가운데 이익률, 비율은 매출 대비
 * 적자면 이익 조각 없이 매입·경비만 (합이 매출보다 큼 → 안내)
 */
export function profitDonut(summary: ManagementSummary): DonutCardData {
  const { revenue, expenses, profit } = summary;
  if (!summary.confirmation.hasData || revenue.total === 0n) {
    return {
      slices: [],
      center: { value: "-", label: "" },
      emptyText: NO_DATA,
    };
  }
  const sum = (keys: string[]) =>
    expenses.items
      .filter((i) => keys.includes(i.key))
      .reduce((n, i) => n + i.amount, 0n);
  const purchase = sum(["goodsPurchase", "materialPurchase"]);
  const operating = sum(["operatingExpense", "otherExpense"]);
  const slices: DonutSlice[] =
    profit.costMode === "purchases"
      ? [
          {
            key: "purchase",
            label: "매입 (상품·원재료)",
            value: s(purchase),
            color: PROFIT_COLORS.purchase,
          },
          {
            key: "operating",
            label: "경비 (경비·그 외)",
            value: s(operating),
            color: PROFIT_COLORS.operating,
          },
        ]
      : [
          {
            key: "operating",
            label: "경비 (경비·그 외)",
            value: s(operating),
            color: PROFIT_COLORS.operating,
          },
        ];
  if (profit.profit > 0n) {
    slices.push({
      key: "profit",
      label: "이익",
      value: s(profit.profit),
      color: PROFIT_COLORS.profit,
    });
  }
  return {
    slices,
    ratioBase: s(revenue.total),
    center: {
      value: profit.margin === null ? "-" : pct(profit.margin),
      label: profit.profit < 0n ? "이익률 (적자)" : "이익률",
    },
    emptyText: null,
  };
}

const BEP_LABELS: ProgressLabels = {
  actual: "실제 매출",
  remaining: "BEP까지 남은 매출",
  reached: "BEP 매출",
  over: "BEP 초과 매출",
};

/** 계산할 수 없을 때 안내 (카드 그래프 자리) */
export function breakEvenEmptyText(b: BreakEvenResult): string | null {
  switch (b.reason) {
    case "no-data":
      return NO_DATA;
    case "no-revenue":
      return `매출이 없어 손익분기점을 계산할 수 없습니다 (고정비 ${formatWonShort(b.fixedCost)}).`;
    case "no-fixed-cost":
      return "고정비가 0원이라 손익분기점이 없습니다. 경비·그 외 지출 입력과 고정비/변동비 구분을 확인하세요.";
    default:
      return null;
  }
}

/**
 * 손익분기점(BEP) 달성률 — 100% 미만: 실제 매출 / BEP까지 남은 매출, 이상: BEP 매출 / 초과 매출 (비율은 BEP 매출 대비)
 * 도달 불가(변동비 ≥ 매출): 변동비 한 조각, 비율은 매출 대비 (변동비율)
 */
export function bepDonut(summary: ManagementSummary): DonutCardData {
  const b = summary.breakEven;
  const emptyText = breakEvenEmptyText(b);
  if (emptyText) {
    return { slices: [], center: { value: "-", label: "" }, emptyText };
  }
  if (b.reason === "not-reachable" || b.bepRevenue === null) {
    return {
      slices: [
        {
          key: "variable",
          label: "변동비 (매출 대비)",
          value: s(b.variableCost),
          color: PALETTE.copper,
        },
      ],
      ratioBase: s(b.revenue),
      center: { value: "도달 불가", label: "BEP 달성률" },
      emptyText: null,
    };
  }
  return {
    slices: progressSlices(b.bepRevenue, b.revenue, METER, BEP_LABELS),
    ratioBase: s(b.bepRevenue),
    center: {
      value: b.rate === null ? "-" : pct(b.rate),
      label: "BEP 달성률",
    },
    emptyText: null,
  };
}
