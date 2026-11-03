// 서비스 대시보드 주소 상태 (순수 함수) — 친구 저장소 ServiceDashboardView 의 연동 규칙을 주소로:
// - 위쪽 기간(연간·1~4분기)을 고르면 아래 '기간별 현황'도 같게
// - 아래에서 분기·연간을 고르면 위쪽도 같게, 월을 고르면 위쪽은 그대로
// - 연도를 바꾸면 둘 다 연간
export type ServiceDashParams = {
  year: number;
  /** 위쪽 KPI 기간: 0 = 연간, 1~4 = 분기 */
  quarter: number;
  /** 출장 건수 그래프 단위 */
  unit: "month" | "quarter";
  /** 실적 표 탭 */
  tab: "month" | "quarter" | "year";
  /** 기간별 현황: "year" | "q1"~"q4" | "m1"~"m12" */
  scope: string;
};

const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : "";
const SCOPE = /^(year|q[1-4]|m([1-9]|1[0-2]))$/;

export function parseServiceDashParams(
  sp: Record<string, string | string[] | undefined>,
  thisYear: number,
): ServiceDashParams {
  const y = Number(str(sp.year));
  const year = Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : thisYear;
  const q = Number(str(sp.quarter));
  const quarter = [1, 2, 3, 4].includes(q) ? q : 0;
  const scope = SCOPE.test(str(sp.scope))
    ? str(sp.scope)
    : quarter
      ? `q${quarter}`
      : "year";
  return {
    year,
    quarter,
    unit: str(sp.unit) === "quarter" ? "quarter" : "month",
    tab:
      (["month", "quarter", "year"] as const).find((t) => t === str(sp.tab)) ??
      "month",
    scope,
  };
}

export function serviceDashHref(
  p: ServiceDashParams,
  change: Partial<ServiceDashParams> = {},
) {
  const n = { ...p, ...change };
  const q = new URLSearchParams({ year: String(n.year) });
  if (n.quarter) q.set("quarter", String(n.quarter));
  if (n.unit !== "month") q.set("unit", n.unit);
  if (n.tab !== "month") q.set("tab", n.tab);
  if (n.scope !== (n.quarter ? `q${n.quarter}` : "year"))
    q.set("scope", n.scope);
  return `/service?${q}`;
}

/** 위쪽 기간 → 아래도 같게 */
export const withPeriod = (quarter: number): Partial<ServiceDashParams> => ({
  quarter,
  scope: quarter ? `q${quarter}` : "year",
});

/** 아래 기간 → 분기·연간이면 위쪽도, 월이면 아래만 */
export function withScope(scope: string): Partial<ServiceDashParams> {
  if (scope.startsWith("m")) return { scope };
  return withPeriod(scope === "year" ? 0 : Number(scope.slice(1)));
}

export const withYear = (year: number): Partial<ServiceDashParams> => ({
  year,
  quarter: 0,
  scope: "year",
});

export function scopeOf(p: ServiceDashParams) {
  if (p.scope.startsWith("q"))
    return { year: p.year, quarter: Number(p.scope.slice(1)) };
  if (p.scope.startsWith("m"))
    return { year: p.year, month: Number(p.scope.slice(1)) };
  return { year: p.year };
}

export function scopeLabel(p: ServiceDashParams) {
  if (p.scope.startsWith("q")) return `${p.year}년 ${p.scope.slice(1)}분기`;
  if (p.scope.startsWith("m")) return `${p.year}년 ${p.scope.slice(1)}월`;
  return `${p.year}년 전체`;
}

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 0)).getUTCDate();

/** 기간 → 출장보고서 목록 필터 주소의 출장 시작일 범위 (from, to) */
export function dateRange(
  year: number,
  scope: { quarter?: number; month?: number },
) {
  const [m1, m2] = scope.month
    ? [scope.month, scope.month]
    : scope.quarter
      ? [(scope.quarter - 1) * 3 + 1, scope.quarter * 3]
      : [1, 12];
  return {
    from: `${year}-${pad(m1)}-01`,
    to: `${year}-${pad(m2)}-${pad(lastDay(year, m2))}`,
  };
}

/** 출장보고서 목록으로 가는 주소 (대시보드 막대·지도·순위 → 필터) */
export function reportsHref(
  year: number,
  scope: { quarter?: number; month?: number },
  extra: Record<string, string> = {},
) {
  return `/service/reports?${new URLSearchParams({ ...dateRange(year, scope), ...extra })}`;
}
