// 서비스팀 대시보드 집계 (순수 함수) — 친구 저장소 backend/service/dashboard.py 그대로 (specs/07 S절)
// - 기간 기준 = 출장 시작일. 없으면 어느 기간에도 넣지 않고 따로 센다
// - 출장 1건 = 출장보고서 1건, 유상 비율 = 유상 ÷ (유상 + 무상) (미입력 제외)
// - 지역: 시·도 + 시·군·구, 비율 분모 = 기간 전체 출장(미지정 포함)
// - 담당자: 작성자 + 동행자, 보고서 1건에 1명 1회 / 교체 부품: 부품을 쓴 보고서 수, 수량은 입력된 것만
// - 금액(부품 비용·매출)은 계산하지 않는다
// 비율은 0~1 로 두고 표시할 때 % (친구 앱은 소수 1자리 % 로 반올림해 돌려줌 — 대조는 같은 반올림으로)
import {
  SHORT,
  SIDO,
  SIDO_POINT,
  SIGUNGU,
  regionLabel,
} from "../regions/regions";

export const TOP_N = 10;

export type DashRow = {
  /** "YYYY-MM-DD" */
  tripStart: string | null;
  billing: "PAID" | "FREE" | null;
  region: string | null;
  sigungu: string | null;
  authorName: string;
  companions: string[];
  products: { modelName: string; quantity: number | null }[];
  parts: { partId: string; name: string; quantity: number | null }[];
};

export type Summary = {
  trips: number;
  paid: number;
  free: number;
  billingUnset: number;
  /** 0~1, 유상·무상 둘 다 0이면 null */
  paidRatio: number | null;
  productQty: number;
  reportsWithParts: number;
};

export function summarize(
  rows: {
    billing: DashRow["billing"];
    products: { quantity: number | null }[];
    parts: unknown[];
  }[],
): Summary {
  const paid = rows.filter((r) => r.billing === "PAID").length;
  const free = rows.filter((r) => r.billing === "FREE").length;
  return {
    trips: rows.length,
    paid,
    free,
    billingUnset: rows.length - paid - free,
    paidRatio: paid + free ? paid / (paid + free) : null,
    productQty: rows.reduce(
      (n, r) => n + r.products.reduce((m, p) => m + (p.quantity ?? 0), 0),
      0,
    ),
    reportsWithParts: rows.filter((r) => r.parts.length > 0).length,
  };
}

const QUARTER_MONTHS: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};
const yearOf = (r: DashRow) =>
  r.tripStart ? Number(r.tripStart.slice(0, 4)) : null;
const monthOf = (r: DashRow) => Number(r.tripStart!.slice(5, 7));

export function serviceSummary(rows: DashRow[], year: number) {
  const inYear = rows.filter((r) => yearOf(r) === year);
  const byMonth = (m: number) => inYear.filter((r) => monthOf(r) === m);
  return {
    annual: summarize(inYear),
    quarters: [1, 2, 3, 4].map((q) => ({
      quarter: q,
      ...summarize(QUARTER_MONTHS[q].flatMap(byMonth)),
    })),
    months: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      ...summarize(byMonth(i + 1)),
    })),
  };
}

export type Scope = { year: number; quarter?: number; month?: number };

export function rowsInScope(rows: DashRow[], scope: Scope) {
  const months = scope.month
    ? [scope.month]
    : scope.quarter
      ? QUARTER_MONTHS[scope.quarter]
      : null;
  return rows.filter(
    (r) => yearOf(r) === scope.year && (!months || months.includes(monthOf(r))),
  );
}

export type RankRow = {
  label: string;
  /** 링크용 원래 값 (기타는 없음) */
  key?: string;
  isOther?: boolean;
  reports: number;
  qty?: number;
  qtyMissing?: number;
  priceMin?: number | null;
  priceMax?: number | null;
  priceSites?: number;
};

// 파이썬 sorted(key=(-값, label)) — 글자 코드 순
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** 상위 10 + "기타 N개" (기타는 보고서 수·수량·수량 미입력만 더함) */
export function top(rows: RankRow[], key: "reports" | "qty"): RankRow[] {
  const sorted = [...rows].sort(
    (a, b) => (b[key] ?? 0) - (a[key] ?? 0) || cmp(a.label, b.label),
  );
  if (sorted.length <= TOP_N) return sorted;
  const rest = sorted.slice(TOP_N);
  const other: RankRow = {
    label: `기타 ${rest.length}개`,
    isOther: true,
    reports: rest.reduce((n, r) => n + r.reports, 0),
  };
  if (sorted[0].qty !== undefined)
    other.qty = rest.reduce((n, r) => n + (r.qty ?? 0), 0);
  if (sorted[0].qtyMissing !== undefined)
    other.qtyMissing = rest.reduce((n, r) => n + (r.qtyMissing ?? 0), 0);
  return [...sorted.slice(0, TOP_N), other];
}

const people = (r: DashRow) => {
  const names = new Set<string>();
  if (r.authorName.trim()) names.add(r.authorName.trim());
  for (const c of r.companions) if (c.trim()) names.add(c.trim());
  return names;
};

export type RegionPoint = {
  sido: string;
  sigungu: string | null;
  label: string;
  /** 지도 이름표 (시·군·구 또는 "충북(시·군·구 미확인)") */
  short: string;
  trips: number;
  ratio: number | null;
  lat: number;
  lon: number;
};

/** 시·군·구별 버블, 시·도만 아는 것, 미지정. 비율 분모 = 전체 출장 건수 */
export function regional(rows: DashRow[]) {
  const total = rows.length;
  const counts = new Map<
    string,
    { sido: string | null; sigungu: string | null; n: number }
  >();
  for (const r of rows) {
    const k = `${r.region}|${r.sigungu}`;
    const c = counts.get(k) ?? { sido: r.region, sigungu: r.sigungu, n: 0 };
    c.n++;
    counts.set(k, c);
  }
  const ratio = (n: number) => (total ? n / total : null);
  const bySigungu: RegionPoint[] = [];
  const byRegionOnly: RegionPoint[] = [];
  let unassigned = 0;
  for (const { sido, sigungu, n } of counts.values()) {
    if (!sido) {
      unassigned += n;
      continue;
    }
    if (!sigungu) {
      const [lat, lon] = SIDO_POINT[sido];
      byRegionOnly.push({
        sido,
        sigungu: null,
        label: regionLabel(sido, null),
        short: `${SHORT[sido]}(시·군·구 미확인)`,
        trips: n,
        ratio: ratio(n),
        lat,
        lon,
      });
    } else {
      const [lat, lon] = SIGUNGU[sido][sigungu];
      bySigungu.push({
        sido,
        sigungu,
        label: regionLabel(sido, sigungu),
        short: sido === "세종특별자치시" ? "세종" : sigungu,
        trips: n,
        ratio: ratio(n),
        lat,
        lon,
      });
    }
  }
  const order = (a: RegionPoint, b: RegionPoint) =>
    b.trips - a.trips ||
    SIDO.indexOf(a.sido as (typeof SIDO)[number]) -
      SIDO.indexOf(b.sido as (typeof SIDO)[number]) ||
    cmp(a.label, b.label);
  return {
    total,
    bySigungu: bySigungu.sort(order),
    byRegionOnly: byRegionOnly.sort(order),
    unassigned,
    unassignedRatio: ratio(unassigned),
  };
}

export type PartPrice = {
  min: number | null;
  max: number | null;
  sites: number;
};

/** 교체 부품 순위 — 부품을 쓴 보고서 수, 수량은 입력된 것만 (대시보드 순위·메인 카드·AI 입력 공용) */
export function partRanking(
  rows: Pick<DashRow, "parts">[],
  partPrices: Map<string, PartPrice> = new Map(),
): RankRow[] {
  const part = new Map<
    string,
    { name: string; reports: number; qty: number; missing: number }
  >();
  for (const r of rows) {
    for (const p of r.parts) {
      const x = part.get(p.partId) ?? {
        name: p.name,
        reports: 0,
        qty: 0,
        missing: 0,
      };
      x.reports++;
      if (p.quantity === null) x.missing++;
      else x.qty += p.quantity;
      part.set(p.partId, x);
    }
  }
  return top(
    [...part].map(([id, x]) => {
      const price = partPrices.get(id) ?? { min: null, max: null, sites: 0 };
      return {
        key: id,
        label: x.name,
        reports: x.reports,
        qty: x.qty,
        qtyMissing: x.missing,
        priceMin: price.min,
        priceMax: price.max,
        priceSites: price.sites,
      };
    }),
    "reports",
  );
}

/** 기간(연·분기·월) 유·무상, 지역, 교체 부품·제품 모델·담당자 순위 */
export function serviceBreakdown(
  rows: DashRow[],
  scope: Scope,
  partPrices: Map<string, PartPrice>,
) {
  const inScope = rowsInScope(rows, scope);
  const s = summarize(inScope);

  const model = new Map<
    string,
    { reports: number; qty: number; missing: number }
  >();
  const person = new Map<string, number>();
  for (const r of inScope) {
    for (const m of new Set(r.products.map((p) => p.modelName))) {
      const x = model.get(m) ?? { reports: 0, qty: 0, missing: 0 };
      x.reports++;
      model.set(m, x);
    }
    for (const p of r.products) {
      const x = model.get(p.modelName)!;
      if (p.quantity === null) x.missing++;
      else x.qty += p.quantity;
    }
    for (const n of people(r)) person.set(n, (person.get(n) ?? 0) + 1);
  }

  return {
    billing: {
      paid: s.paid,
      free: s.free,
      billingUnset: s.billingUnset,
      paidRatio: s.paidRatio,
    },
    region: regional(inScope),
    byPart: partRanking(inScope, partPrices),
    byModel: top(
      [...model].map(([m, x]) => ({
        key: m,
        label: m,
        qty: x.qty,
        reports: x.reports,
        qtyMissing: x.missing,
      })),
      "qty",
    ),
    byPerson: top(
      [...person].map(([n, reports]) => ({ key: n, label: n, reports })),
      "reports",
    ),
  };
}

/** 출장 시작일이 있는 모든 연도 + 올해 (최신순) */
export function yearsAvailable(rows: DashRow[], currentYear: number) {
  const ys = new Set(rows.map(yearOf).filter((y): y is number => y !== null));
  ys.add(currentYear);
  return [...ys].sort((a, b) => b - a);
}
