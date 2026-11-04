// 친구 저장소 backend/service/tests/test_dashboard.py 손계산 표 그대로 (출장 시작일 기준)
// | r1 2026-01-01 유상 김현진 대리(+김현진 대리) AVA03×1 부품 A,B 충북 청주시
// | r2 2026-03-31 무상 박서비스(+김현진 대리) AVA03×2, AVB01×(없음) 부품 A 서울 강남구
// | r3 2026-04-01 미입력 김현진 대리 AVB01×1 (주소 없음)
// | r4 2026-12-31 유상 박서비스(+이현장) AVA03×3 부품 B×2 경기 성남시
// | r5 2025-12-31 유상 (다른 연도) / r6 출장일 없음
import { describe, expect, it } from "vitest";

import { parseAddress } from "../regions/regions";
import {
  serviceBreakdown,
  serviceSummary,
  yearsAvailable,
  type DashRow,
  type Summary,
} from "./dashboard";

const row = (
  tripStart: string | null,
  billing: DashRow["billing"],
  authorName: string,
  companions: string[],
  products: [string, number | null][],
  parts: [string, number | null][],
  address: string,
): DashRow => ({
  tripStart,
  billing,
  authorName,
  companions,
  products: products.map(([modelName, quantity]) => ({ modelName, quantity })),
  parts: parts.map(([name, quantity]) => ({ partId: name, name, quantity })),
  ...parseAddress(address),
});

const ROWS = [
  row(
    "2026-01-01",
    "PAID",
    "김현진 대리",
    ["김현진 대리"],
    [["AVA03", 1]],
    [
      ["A", null],
      ["B", null],
    ],
    "충북 청주시",
  ),
  row(
    "2026-03-31",
    "FREE",
    "박서비스",
    ["김현진 대리"],
    [
      ["AVA03", 2],
      ["AVB01", null],
    ],
    [["A", null]],
    "서울 강남구",
  ),
  row("2026-04-01", null, "김현진 대리", [], [["AVB01", 1]], [], ""),
  row(
    "2026-12-31",
    "PAID",
    "박서비스",
    ["이현장"],
    [["AVA03", 3]],
    [["B", 2]],
    "경기 성남시",
  ),
  row(
    "2025-12-31",
    "PAID",
    "박서비스",
    [],
    [["AVA03", 9]],
    [["A", null]],
    "부산",
  ),
  row(null, "FREE", "김현진 대리", [], [], [], ""),
];
const pick = (s: Summary) => [
  s.trips,
  s.paid,
  s.free,
  s.billingUnset,
  s.paidRatio === null ? null : Math.round(s.paidRatio * 1000) / 10,
  s.productQty,
  s.reportsWithParts,
];
const none = new Map();

describe("serviceSummary", () => {
  it("연간·분기·월 (친구 test_annual_quarters_months)", () => {
    const d = serviceSummary(ROWS, 2026);
    expect(pick(d.annual)).toEqual([4, 2, 1, 1, 66.7, 7, 3]);
    expect(d.quarters.map(pick)).toEqual([
      [2, 1, 1, 0, 50, 3, 2],
      [1, 0, 0, 1, null, 1, 0],
      [0, 0, 0, 0, null, 0, 0],
      [1, 1, 0, 0, 100, 3, 1],
    ]);
    expect(d.months).toHaveLength(12);
    expect(pick(d.months[0])).toEqual([1, 1, 0, 0, 100, 1, 1]);
    expect(pick(d.months[2])).toEqual([1, 0, 1, 0, 0, 2, 1]);
    expect(yearsAvailable(ROWS, 2026)).toEqual([2026, 2025]);
  });
});

describe("serviceBreakdown", () => {
  it("연간 (친구 test_breakdown_year)", () => {
    const d = serviceBreakdown(ROWS, { year: 2026 }, none);
    expect(d.billing).toEqual({
      paid: 2,
      free: 1,
      billingUnset: 1,
      paidRatio: 2 / 3,
    });
    expect(d.region.bySigungu.map((r) => [r.label, r.trips, r.ratio])).toEqual([
      ["서울특별시 강남구", 1, 0.25],
      ["경기도 성남시", 1, 0.25],
      ["충청북도 청주시", 1, 0.25],
    ]);
    expect([
      d.region.unassigned,
      d.region.unassignedRatio,
      d.region.total,
    ]).toEqual([1, 0.25, 4]);
    expect(d.region.byRegionOnly).toEqual([]);
    expect(
      d.byPart.map((p) => [p.label, p.reports, p.qty, p.qtyMissing]),
    ).toEqual([
      ["A", 2, 0, 2],
      ["B", 2, 2, 1],
    ]);
    expect(
      d.byModel.map((m) => [m.label, m.qty, m.reports, m.qtyMissing]),
    ).toEqual([
      ["AVA03", 6, 3, 0],
      ["AVB01", 1, 2, 1],
    ]);
    expect(d.byPerson.map((p) => [p.label, p.reports])).toEqual([
      ["김현진 대리", 3],
      ["박서비스", 2],
      ["이현장", 1],
    ]);
  });

  it("지역 비율 합 100% (친구 test_regional_ratios_sum_to_100)", () => {
    const extra = [
      "부산 해운대구 우동",
      "부산광역시 해운대구",
      "충북 오창읍",
      "",
    ].map((a) => row("2026-06-10", null, "", [], [], [], a));
    const d = serviceBreakdown(
      [...ROWS, ...extra],
      { year: 2026, month: 6 },
      none,
    ).region;
    expect(d.bySigungu.map((r) => [r.label, r.trips, r.ratio])).toEqual([
      ["부산광역시 해운대구", 2, 0.5],
    ]);
    expect(d.byRegionOnly.map((r) => [r.label, r.trips, r.ratio])).toEqual([
      ["충청북도(시·군·구 미확인)", 1, 0.25],
    ]);
    expect([d.unassigned, d.unassignedRatio]).toEqual([1, 0.25]);
    const h = d.bySigungu[0];
    expect(h.lat > 35 && h.lat < 35.4 && h.lon > 128.9 && h.lon < 129.4).toBe(
      true,
    );
  });

  it("기간 (친구 test_breakdown_scope)", () => {
    const q1 = serviceBreakdown(ROWS, { year: 2026, quarter: 1 }, none);
    expect(q1.byPerson.map((p) => [p.label, p.reports])).toEqual([
      ["김현진 대리", 2],
      ["박서비스", 1],
    ]);
    expect(q1.billing.paidRatio).toBe(0.5);
    expect(
      serviceBreakdown(ROWS, { year: 2026, month: 12 }, none).byPart.map(
        (p) => [p.label, p.qty],
      ),
    ).toEqual([["B", 2]]);
    expect(
      serviceBreakdown(ROWS, { year: 2026, month: 6 }, none).byPart,
    ).toEqual([]);
  });

  it("출장지 가격은 범위만 (합계 안 함)", () => {
    const prices = new Map([["A", { min: 50000, max: 70000, sites: 2 }]]);
    const parts = Object.fromEntries(
      serviceBreakdown(ROWS, { year: 2026 }, prices).byPart.map((p) => [
        p.label,
        p,
      ]),
    );
    expect([parts.A.priceMin, parts.A.priceMax, parts.A.priceSites]).toEqual([
      50000, 70000, 2,
    ]);
    expect([parts.B.priceMin, parts.B.priceSites]).toEqual([null, 0]);
  });

  it("상위 10 + 기타 (친구 test_top_n_with_other)", () => {
    const extra = Array.from({ length: 12 }, (_, i) =>
      row(
        "2026-05-01",
        null,
        `담당자${String(i).padStart(2, "0")}`,
        [],
        [],
        [[`P${String(i).padStart(2, "0")}`, null]],
        "",
      ),
    );
    const parts = serviceBreakdown(
      [...ROWS, ...extra],
      { year: 2026 },
      none,
    ).byPart;
    expect(parts).toHaveLength(11);
    const other = parts.at(-1)!;
    expect(other.isOther).toBe(true);
    expect(other.priceMin).toBeUndefined();
    expect(parts.reduce((n, p) => n + p.reports, 0)).toBe(2 + 2 + 12);
  });
});
