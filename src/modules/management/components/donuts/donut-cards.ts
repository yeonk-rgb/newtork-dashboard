// 경영 대시보드 도넛 7개의 데이터 (순수 함수): 조각·가운데 숫자·비율 분모·빈 상태 문구
// 금액은 정수 문자열로 넘기고(BigInt 직렬화), 표시는 DonutCard 가 한다
import { formatWonShort } from "@/shared/format/money";
import { METER, PALETTE, REVENUE_COLORS } from "@/shared/ui/chart-colors";
import type { DonutSlice } from "@/shared/ui/donut-data";

import type { AgingBucket, ManagementSummary } from "../../metrics/types";

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
      color: REVENUE_COLORS[i.key] ?? PALETTE.blue,
    })),
    center: { value: formatWonShort(revenue.total), label: "총매출" },
    emptyText:
      !summary.confirmation.hasData || revenue.total === 0n ? NO_DATA : null,
  };
}

/** 목표 대비 실적 (분기·연간 공용): 실적 / 남은 목표, 초과면 목표 달성분 / 초과분 — 비율은 목표 대비 */
function progressSlices(target: bigint, actual: bigint): DonutSlice[] {
  if (actual <= target) {
    return [
      { key: "actual", label: "실적", value: s(actual), color: METER.fill },
      {
        key: "remaining",
        label: "남은 목표",
        value: s(target - actual),
        color: METER.track,
        muted: true,
      },
    ];
  }
  return [
    {
      key: "actual",
      label: "목표 달성분",
      value: s(target),
      color: METER.fill,
    },
    {
      key: "over",
      label: "초과분",
      value: s(actual - target),
      color: PALETTE.green,
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
    slices: progressSlices(t.target, t.actual),
    ratioBase: s(t.target),
    center: {
      value: t.rate === null ? "-" : pct(t.rate),
      label: "목표 달성률",
    },
    emptyText: null,
  };
}

/** 연간 목표 (선택 기간과 무관하게 그 해 기준) + 진도 눈금(경과율) */
export function annualTargetDonut(summary: ManagementSummary): DonutCardData {
  const p = summary.annualProgress;
  if (!p || p.target === 0n) {
    return {
      slices: [],
      center: { value: "-", label: "" },
      emptyText: `${summary.period.year}년 목표가 설정되지 않았습니다. 목표·항목 설정에서 입력하세요.`,
    };
  }
  return {
    slices: progressSlices(p.target, p.actual),
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

const AGING: { bucket: AgingBucket; label: string; color: string }[] = [
  { bucket: "0-30", label: "0~30일", color: PALETTE.blue },
  { bucket: "31-60", label: "31~60일", color: PALETTE.yellow },
  { bucket: "61-90", label: "61~90일", color: PALETTE.orange },
  { bucket: "90+", label: "90일 초과", color: PALETTE.red },
];

/** 미수금 총액: 경과 구간 — 가운데 총액, 목록에 건수 */
export function receivablesDonut(summary: ManagementSummary): DonutCardData {
  const r = summary.receivables;
  const asOf = `${r.asOf.getUTCMonth() + 1}/${r.asOf.getUTCDate()}`;
  return {
    slices: AGING.map(({ bucket, label, color }) => {
      const a = r.aging.find((x) => x.bucket === bucket);
      return {
        key: bucket,
        label,
        value: s(a?.amount ?? 0n),
        color,
        extra: `${a?.count ?? 0}건`,
      };
    }),
    center: {
      value: formatWonShort(r.total),
      label: `미수금 총액 (${asOf} 기준)`,
    },
    emptyText: r.total === 0n ? `${asOf} 기준 미수금이 없습니다.` : null,
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
            color: PALETTE.orange,
          },
          {
            key: "operating",
            label: "경비 (경비·그 외)",
            value: s(operating),
            color: PALETTE.magenta,
          },
        ]
      : [
          {
            key: "operating",
            label: "경비 (경비·그 외)",
            value: s(operating),
            color: PALETTE.magenta,
          },
        ];
  if (profit.profit > 0n) {
    slices.push({
      key: "profit",
      label: "이익",
      value: s(profit.profit),
      color: PALETTE.blue,
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
