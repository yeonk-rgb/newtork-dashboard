// 출장지별 가격 계산 — 친구 화면 계산(sitePrices.js·PriceBySite·PriceCompare) 그대로인지 손계산으로 고정
import { describe, expect, it } from "vitest";

import {
  compare,
  defaultPart,
  defaultSite,
  diffPct,
  partStats,
  siteRows,
  type Price,
} from "./compute";

const sites = [
  { id: "s1", name: "갑" },
  { id: "s2", name: "을" },
  { id: "s3", name: "병" },
];
const parts = [
  { id: "A", name: "Alpha" },
  { id: "B", name: "Beta" },
  { id: "C", name: "Gamma" },
];
const P = (siteId: string, partId: string, unitPrice: number): Price => ({
  siteId,
  siteName: sites.find((s) => s.id === siteId)!.name,
  partId,
  partName: parts.find((p) => p.id === partId)!.name,
  unitPrice,
  note: "",
});
// A: 갑 100, 을 200, 병 300 / B: 갑 50, 을 70 / C: 없음
const prices = [
  P("s1", "A", 100),
  P("s2", "A", 200),
  P("s3", "A", 300),
  P("s1", "B", 50),
  P("s2", "B", 70),
];

describe("가격 계산", () => {
  it("평균 대비 %·부품 KPI", () => {
    expect(diffPct(150, 100)).toBe(50);
    expect(diffPct(1, null)).toBeNull();
    expect(partStats(prices, "A")).toEqual({
      count: 3,
      min: 100,
      max: 300,
      avg: 200,
    });
    expect(partStats(prices, "C")).toEqual({
      count: 0,
      min: null,
      max: null,
      avg: null,
    });
  });

  it("출장지별 — 가격 높은 순, 미입력은 뒤, 전체 평균 대비", () => {
    const r = siteRows(prices, parts, "s1");
    expect(r.rows.map((x) => [x.part.name, x.price, x.avg, x.diff])).toEqual([
      ["Alpha", 100, 200, -50],
      ["Beta", 50, 60, -16.7],
      ["Gamma", null, null, null],
    ]);
    expect(r.siteAvg).toBe(75);
    expect(
      siteRows(prices, parts, "s1", { showMissing: false }).rows,
    ).toHaveLength(2);
    expect(
      siteRows(prices, parts, "s1", { search: "be" }).rows.map(
        (x) => x.part.name,
      ),
    ).toEqual(["Beta"]);
  });

  it("처음 고르는 출장지·부품 = 가격이 가장 많은 것", () => {
    expect(defaultSite(sites, prices)).toBe("s1");
    expect(defaultPart(parts, prices)).toBe("A");
  });

  it("출장지 비교 — 공통 부품만 / 공통 부품이 없으면 전체", () => {
    const all = compare(prices, sites, "A", new Set(), true);
    expect(all.partRows.map((r) => r.label)).toEqual(["병", "을", "갑"]);
    expect([all.partAvg, all.partMax?.label, all.partMin?.label]).toEqual([
      200,
      "병",
      "갑",
    ]);
    // 병에는 B가 없어 공통 부품 = A 하나
    expect([...all.commonParts]).toEqual(["A"]);
    expect(all.siteAvgRows).toEqual([
      { label: "병", value: 300, parts: 1 },
      { label: "을", value: 200, parts: 1 },
      { label: "갑", value: 100, parts: 1 },
    ]);
    // 병을 빼면 A·B 모두 공통
    const two = compare(prices, sites, "B", new Set(["s3"]), true);
    expect(two.siteAvgRows).toEqual([
      { label: "을", value: 135, parts: 2 },
      { label: "갑", value: 75, parts: 2 },
    ]);
    expect(two.missingSites).toEqual([]);
    // 등록된 부품 전체
    expect(
      compare(prices, sites, "A", new Set(), false).siteAvgRows[0],
    ).toEqual({ label: "병", value: 300, parts: 1 });
    // 공통 부품이 없으면 전체로 (useCommon false)
    const none = compare(
      [P("s1", "A", 1), P("s2", "B", 2)],
      sites,
      "A",
      new Set(["s3"]),
      true,
    );
    expect(none.useCommon).toBe(false);
    expect(none.missingSites.map((s) => s.name)).toEqual(["을"]);
  });
});
