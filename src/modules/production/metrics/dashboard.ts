// 생산 대시보드 집계 (순수 함수). 친구 저장소 backend/production/dashboard.py 그대로:
// - 기간 기준 = 출고일자. 출고일이 없는 행은 실적에서 빼고 따로 센다
// - 확정 출고 수량 = 출고일이 있고 수량이 입력된 행의 수량 합 — 실적·달성률은 이 값으로만
// - 수량 미확정 = 출고일은 있으나 수량이 빈 행 수
// - 분기 목표 = 3개월 월 목표 합 (3개월 모두 입력됐을 때만)
// - 납기 일정 = 납기일자 기준, 같은 납기일 + 같은 수주번호 = 1건 (출고 여부 무관, 실적과 별개)
import { INDUSTRIES } from "@/shared/contracts/production";

import type { ProductionTargets, RecordRow } from "./sales-share";

export const TOP_SELLERS = 10;
export const UNCLASSIFIED_KEY = "NONE";

export type Metrics = {
  confirmed: number;
  /** 출고 일련번호 수 (참고값 — 화면 표시는 안 함, 정렬에만) */
  shipped: number;
  unconfirmed: number;
};

export type PeriodRow = Metrics & {
  target: number | null;
  /** 0~1+, 목표 없으면 null */
  achievement: number | null;
  /** max(목표 − 확정, 0), 목표 없으면 null */
  shortfall: number | null;
};

export type MonthRow = PeriodRow & { month: number };
export type QuarterRow = PeriodRow & {
  quarter: 1 | 2 | 3 | 4;
  /** 입력된 월 목표 수 (0~3) — 3이 아니면 분기 목표 없음 */
  monthTargetsSet: number;
};
export type AnnualRow = PeriodRow & {
  /** 월 목표 합계 (입력된 것만, 하나도 없으면 null) */
  monthlyTargetSum: number | null;
};

export type ProductionSummary = {
  months: MonthRow[];
  quarters: QuarterRow[];
  annual: AnnualRow;
};

export type RankRow = Metrics & { key: string; label: string };

export type Breakdown = {
  byCategory: RankRow[];
  bySeller: RankRow[];
  byModel: RankRow[];
};

const empty = (): Metrics => ({ confirmed: 0, shipped: 0, unconfirmed: 0 });
const add = (m: Metrics, r: RecordRow) => {
  m.shipped++;
  if (r.quantity === null) m.unconfirmed++;
  else m.confirmed += r.quantity;
};
const sum = (list: Metrics[]) =>
  list.reduce(
    (a, b) => ({
      confirmed: a.confirmed + b.confirmed,
      shipped: a.shipped + b.shipped,
      unconfirmed: a.unconfirmed + b.unconfirmed,
    }),
    empty(),
  );

function withTarget<T extends Metrics>(m: T, target: number | null) {
  return {
    ...m,
    target,
    achievement: target ? m.confirmed / target : null,
    shortfall: target === null ? null : Math.max(target - m.confirmed, 0),
  };
}

const shippedYear = (r: RecordRow) => r.shippedDate?.getUTCFullYear() ?? null;
const shippedMonth = (r: RecordRow) => r.shippedDate!.getUTCMonth() + 1;

/** 연간·분기·월별 목표와 실적 */
export function productionSummary(
  rows: RecordRow[],
  targets: ProductionTargets,
  year: number,
): ProductionSummary {
  const byMonth = Array.from({ length: 12 }, empty);
  for (const r of rows) {
    if (shippedYear(r) === year) add(byMonth[shippedMonth(r) - 1], r);
  }
  const months = byMonth.map((m, i) => ({
    month: i + 1,
    ...withTarget(m, targets.monthly.get(i + 1) ?? null),
  }));
  const quarters = ([1, 2, 3, 4] as const).map((q) => {
    const ms = [1, 2, 3].map((k) => (q - 1) * 3 + k);
    const set = ms.filter((m) => targets.monthly.has(m)).length;
    const target =
      set === 3 ? ms.reduce((n, m) => n + targets.monthly.get(m)!, 0) : null;
    return {
      quarter: q,
      monthTargetsSet: set,
      ...withTarget(sum(ms.map((m) => byMonth[m - 1])), target),
    };
  });
  const monthlyValues = [...targets.monthly.values()];
  return {
    months,
    quarters,
    annual: {
      ...withTarget(sum(byMonth), targets.annual),
      monthlyTargetSum:
        monthlyValues.length > 0
          ? monthlyValues.reduce((a, b) => a + b, 0)
          : null,
    },
  };
}

const rankSort = (a: RankRow, b: RankRow) =>
  b.confirmed - a.confirmed ||
  b.shipped - a.shipped ||
  a.label.localeCompare(b.label, "ko");

function groupBy(rows: RecordRow[], keyOf: (r: RecordRow) => string) {
  const map = new Map<string, Metrics>();
  for (const r of rows) {
    const k = keyOf(r);
    const m = map.get(k) ?? empty();
    add(m, r);
    map.set(k, m);
  }
  return map;
}

export type Scope = { year: number; quarter?: number; month?: number };

/** 기간(연·분기·월) 출고분의 산업 분야·판매처(상위 10)·제품 모델별 판매량 */
export function productionBreakdown(
  rows: RecordRow[],
  categories: Map<string, string>,
  scope: Scope,
): Breakdown {
  const shipped = rows.filter((r) => {
    if (shippedYear(r) !== scope.year) return false;
    const m = shippedMonth(r);
    if (scope.month) return m === scope.month;
    if (scope.quarter) return Math.ceil(m / 3) === scope.quarter;
    return true;
  });

  // 산업 분야: 7가지를 모두 보여주고, 미분류는 있을 때만 마지막에
  const byCat = groupBy(
    shipped,
    (r) => (r.orderNo && categories.get(r.orderNo)) || UNCLASSIFIED_KEY,
  );
  const byCategory: RankRow[] = INDUSTRIES.map((i) => ({
    key: i.key,
    label: i.label,
    ...(byCat.get(i.key) ?? empty()),
  }));
  if (byCat.has(UNCLASSIFIED_KEY)) {
    byCategory.push({
      key: UNCLASSIFIED_KEY,
      label: "미분류",
      ...byCat.get(UNCLASSIFIED_KEY)!,
    });
  }

  const sellers = [...groupBy(shipped, (r) => r.seller)]
    .map(([k, m]) => ({ key: k, label: k || "(판매처 없음)", ...m }))
    .sort(rankSort);
  const bySeller =
    sellers.length > TOP_SELLERS
      ? [
          ...sellers.slice(0, TOP_SELLERS),
          {
            key: "OTHER_SELLERS",
            label: `기타 ${sellers.length - TOP_SELLERS}곳`,
            ...sum(sellers.slice(TOP_SELLERS)),
          },
        ]
      : sellers;

  const byModel = [...groupBy(shipped, (r) => r.modelCode)]
    .map(([k, m]) => ({ key: k, label: k || "(모델명 없음)", ...m }))
    .sort(rankSort);

  return { byCategory, bySeller, byModel };
}

/** 그 해 1~12월 납기 일정 수 (같은 납기일 + 같은 수주번호 = 1건, 수주번호 없으면 일련번호 단위) */
export function dueEventsByMonth(rows: RecordRow[], year: number): number[] {
  const keys = Array.from({ length: 12 }, () => new Set<string>());
  for (const r of rows) {
    if (!r.dueDate || r.dueDate.getUTCFullYear() !== year) continue;
    const day = r.dueDate.toISOString().slice(0, 10);
    keys[r.dueDate.getUTCMonth()].add(
      `${day}|${r.orderNo || `#${r.sheetName}::${r.serialNo}`}`,
    );
  }
  return keys.map((s) => s.size);
}
