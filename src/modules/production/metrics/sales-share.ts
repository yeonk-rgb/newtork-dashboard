// 생산팀 집계 (순수 함수 — DB·화면 모름). 친구 저장소 backend/production/dashboard.py 규칙 그대로:
// - 기간 기준 = 출고일자. 출고일이 없는 행은 실적에 넣지 않는다
// - 실적 = 확정 출고 수량 (사람이 입력한 수량 합계). 수량이 빈 행은 "수량 미확정"으로 따로 센다 — 행 수를 수량으로 바꾸지 않음 (specs/07 Q1)
// - 산업분야 = 수주번호별 사업구분. 지정하지 않은 수주번호는 "미분류"
// - 납기 일정 = 같은 납기일 + 같은 수주번호 = 1건 (수주번호가 없으면 일련번호 단위), 출고 여부와 무관
import {
  INDUSTRIES,
  OTHER_SERIES_KEY,
  type ProductionOverview,
  type SalesShareItem,
  type SalesShareResult,
} from "@/shared/contracts/production";
import {
  periodDateRange,
  periodMonths,
  type Period,
} from "@/shared/period/period";

export type RecordRow = {
  sheetName: string;
  serialNo: string;
  orderNo: string;
  modelCode: string;
  /** M열 판매처 (생산 대시보드 판매처별) */
  seller: string;
  shippedDate: Date | null;
  dueDate: Date | null;
  quantity: number | null;
  /** 시드(가짜) 데이터 */
  sample: boolean;
};

export type ProductionTargets = {
  annual: number | null;
  /** month(1~12) → 목표. 입력하지 않은 달은 없음 */
  monthly: Map<number, number>;
};

/** 제품별 그래프 조각 수 상한 — 넘으면 수량 상위 (MAX - 1)개 + "기타 모델" */
export const MAX_SERIES_SLICES = 6;
const NO_MODEL_LABEL = "(모델명 없음)";

function inRange(date: Date | null, range: { gte: Date; lt: Date }) {
  return date !== null && date >= range.gte && date < range.lt;
}

function shippedIn(rows: RecordRow[], period: Period) {
  const range = periodDateRange(period);
  return rows.filter((r) => inRange(r.shippedDate, range));
}

function baseResult(rows: RecordRow[]) {
  return {
    source: "production" as const,
    basis: "quantity" as const,
    unconfirmedRows: rows.filter((r) => r.quantity === null).length,
    hasSample: rows.some((r) => r.sample),
  };
}

const byQuantityDesc = (a: SalesShareItem, b: SalesShareItem) =>
  b.quantity - a.quantity || a.label.localeCompare(b.label, "ko");

/** 산업분야별 확정 출고 수량 — 0인 분류는 빼고, 미분류는 조각 대신 unclassifiedQuantity 로 */
export function salesShareByIndustry(
  rows: RecordRow[],
  categories: Map<string, string>,
  period: Period,
): SalesShareResult {
  const shipped = shippedIn(rows, period);
  const sums = new Map<string, number>();
  let unclassified = 0;
  for (const r of shipped) {
    if (r.quantity === null) continue;
    const key = r.orderNo ? categories.get(r.orderNo) : undefined;
    if (!key) unclassified += r.quantity;
    else sums.set(key, (sums.get(key) ?? 0) + r.quantity);
  }
  const items = INDUSTRIES.filter((i) => (sums.get(i.key) ?? 0) > 0)
    .map((i) => ({
      key: i.key,
      label: i.label,
      amount: 0n,
      quantity: sums.get(i.key)!,
    }))
    .sort(byQuantityDesc);
  return {
    ...baseResult(shipped),
    items,
    unclassifiedQuantity: unclassified,
  };
}

/** 제품(모델명, 엑셀 C열 원본 값)별 확정 출고 수량 */
export function salesShareBySeries(
  rows: RecordRow[],
  period: Period,
): SalesShareResult {
  const shipped = shippedIn(rows, period);
  const sums = new Map<string, number>();
  for (const r of shipped) {
    if (r.quantity === null) continue;
    sums.set(r.modelCode, (sums.get(r.modelCode) ?? 0) + r.quantity);
  }
  const all = [...sums]
    .filter(([, quantity]) => quantity > 0)
    .map(([code, quantity]) => ({
      key: code,
      label: code || NO_MODEL_LABEL,
      amount: 0n,
      quantity,
    }))
    .sort(byQuantityDesc);
  const items =
    all.length <= MAX_SERIES_SLICES
      ? all
      : [
          ...all.slice(0, MAX_SERIES_SLICES - 1),
          {
            key: OTHER_SERIES_KEY,
            label: `기타 모델 ${all.length - (MAX_SERIES_SLICES - 1)}개`,
            amount: 0n,
            quantity: all
              .slice(MAX_SERIES_SLICES - 1)
              .reduce((n, i) => n + i.quantity, 0),
          },
        ];
  return { ...baseResult(shipped), items, unclassifiedQuantity: 0 };
}

/** 기간 목표: 월 = 그 달, 분기·누적 = 월 목표 합(모두 입력됐을 때만), 연간 = 연간 목표 */
export function periodTarget(
  period: Period,
  targets: ProductionTargets,
): { target: number | null; note: string | null } {
  if (period.unit === "year") {
    return targets.annual === null
      ? { target: null, note: "연간 목표 미설정" }
      : { target: targets.annual, note: null };
  }
  const months = periodMonths(period).map((m) => m.month);
  const set = months.filter((m) => targets.monthly.has(m));
  if (set.length === months.length) {
    return {
      target: set.reduce((n, m) => n + targets.monthly.get(m)!, 0),
      note: null,
    };
  }
  if (months.length === 1) return { target: null, note: "월 목표 미설정" };
  return {
    target: null,
    note:
      set.length === 0
        ? "월 목표 미설정"
        : `월 목표 ${set.length}/${months.length}개월만 입력`,
  };
}

function dueEventKey(r: RecordRow) {
  return `${r.dueDate!.toISOString().slice(0, 10)}|${r.orderNo || `#${r.sheetName}::${r.serialNo}`}`;
}

/** 메인 "팀별 현황" 생산 카드 */
export function productionOverview(
  rows: RecordRow[],
  targets: ProductionTargets,
  period: Period,
): ProductionOverview {
  const shipped = shippedIn(rows, period);
  const confirmedQuantity = shipped.reduce((n, r) => n + (r.quantity ?? 0), 0);
  const { target, note } = periodTarget(period, targets);

  const range = periodDateRange(period);
  const events = new Map<string, boolean>(); // key → 출고 대기 제품이 있는지
  for (const r of rows) {
    if (!inRange(r.dueDate, range)) continue;
    const key = dueEventKey(r);
    events.set(key, (events.get(key) ?? false) || r.shippedDate === null);
  }
  const dueRows = rows.filter((r) => inRange(r.dueDate, range));

  return {
    confirmedQuantity,
    target,
    targetNote: note,
    achievement: target ? confirmedQuantity / target : null,
    unconfirmedRows: shipped.filter((r) => r.quantity === null).length,
    dueEvents: events.size,
    dueEventsPending: [...events.values()].filter(Boolean).length,
    hasSample: shipped.some((r) => r.sample) || dueRows.some((r) => r.sample),
  };
}
