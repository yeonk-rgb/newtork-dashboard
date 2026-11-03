// 생산 대시보드 주소 상태 (순수 함수) — 친구 저장소 ProductionDashboardView 의 연동 규칙을 주소로:
// - 위쪽 기간(연간·1~4분기)을 고르면 아래 '분류별 판매량' 기간도 같게, 납기 예정 월이 그 분기 밖이면 분기 첫 달로
// - 아래에서 분기·연간을 고르면 위쪽도 같게, 월을 고르면 위쪽은 그대로 두고 납기 예정 월을 그 달로
// - 납기 예정 월 기본값: 올해면 이번 달, 다른 해면 1월
export type DashboardParams = {
  year: number;
  /** 위쪽 KPI·달성률 기간: 0 = 연간, 1~4 = 분기 */
  quarter: number;
  /** 실적 그래프 단위 */
  unit: "month" | "quarter";
  /** 실적 표 탭 */
  tab: "month" | "quarter" | "year";
  /** 분류별 판매량 기간: "year" | "q1"~"q4" | "m1"~"m12" */
  scope: string;
  /** 납기 예정 카드 월 1~12 */
  due: number;
};

const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : "";
const SCOPE = /^(year|q[1-4]|m([1-9]|1[0-2]))$/;

export function parseDashboardParams(
  sp: Record<string, string | string[] | undefined>,
  today: { year: number; month: number },
): DashboardParams {
  const y = Number(str(sp.year));
  const year = Number.isInteger(y) && y >= 1900 && y <= 2100 ? y : today.year;
  const q = Number(str(sp.quarter));
  const quarter = [1, 2, 3, 4].includes(q) ? q : 0;
  const scope = SCOPE.test(str(sp.scope))
    ? str(sp.scope)
    : quarter
      ? `q${quarter}`
      : "year";
  const d = Number(str(sp.due));
  const defaultDue = year === today.year ? today.month : 1;
  let due = Number.isInteger(d) && d >= 1 && d <= 12 ? d : defaultDue;
  if (!str(sp.due) && scope.startsWith("m")) due = Number(scope.slice(1));
  if (!str(sp.due) && quarter && Math.ceil(due / 3) !== quarter)
    due = (quarter - 1) * 3 + 1;
  return {
    year,
    quarter,
    unit: str(sp.unit) === "quarter" ? "quarter" : "month",
    tab:
      (["month", "quarter", "year"] as const).find((t) => t === str(sp.tab)) ??
      "month",
    scope,
    due,
  };
}

export function dashboardHref(
  p: DashboardParams,
  change: Partial<DashboardParams> = {},
) {
  const n = { ...p, ...change };
  const q = new URLSearchParams();
  q.set("year", String(n.year));
  if (n.quarter) q.set("quarter", String(n.quarter));
  if (n.unit !== "month") q.set("unit", n.unit);
  if (n.tab !== "month") q.set("tab", n.tab);
  if (n.scope !== (n.quarter ? `q${n.quarter}` : "year"))
    q.set("scope", n.scope);
  q.set("due", String(n.due));
  return `/production?${q}`;
}

/** 위쪽 기간 바꾸기 — 아래 기간도 같게, 납기 예정 월은 그 분기 안으로 */
export function withQuarter(
  p: DashboardParams,
  quarter: number,
): Partial<DashboardParams> {
  const due =
    quarter && Math.ceil(p.due / 3) !== quarter ? (quarter - 1) * 3 + 1 : p.due;
  return { quarter, scope: quarter ? `q${quarter}` : "year", due };
}

/** 아래 기간 바꾸기 — 분기·연간이면 위쪽도, 월이면 납기 예정 월만 */
export function withScope(
  p: DashboardParams,
  scope: string,
): Partial<DashboardParams> {
  if (scope.startsWith("m")) return { scope, due: Number(scope.slice(1)) };
  const quarter = scope === "year" ? 0 : Number(scope.slice(1));
  return { ...withQuarter(p, quarter), scope };
}

/** 연도 바꾸기 — 기간은 연간으로, 납기 예정 월은 기본값 */
export function withYear(
  year: number,
  today: { year: number; month: number },
): Partial<DashboardParams> {
  return {
    year,
    quarter: 0,
    scope: "year",
    due: year === today.year ? today.month : 1,
  };
}

export function scopeOf(p: DashboardParams) {
  if (p.scope.startsWith("q"))
    return { year: p.year, quarter: Number(p.scope.slice(1)) };
  if (p.scope.startsWith("m"))
    return { year: p.year, month: Number(p.scope.slice(1)) };
  return { year: p.year };
}

export function scopeLabel(p: DashboardParams) {
  if (p.scope.startsWith("q")) return `${p.year}년 ${p.scope.slice(1)}분기`;
  if (p.scope.startsWith("m")) return `${p.year}년 ${p.scope.slice(1)}월`;
  return `${p.year}년 전체`;
}
