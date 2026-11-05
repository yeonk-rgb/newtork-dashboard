// 단가 계산 — 친구 우민영 저장소 lib/pricing.js 가상 값(VX…)으로 같은 결과인지 + 피드백(기준값 = 기준단가)
import { describe, expect, it } from "vitest";

import {
  companyComparison,
  compareToBase,
  itemQuotes,
  itemRows,
  latestByCompany,
  matchesQuery,
  partKey,
  priceStats,
  round1,
  type ItemInput,
  type QuoteInput,
} from "./compute";

const item = (
  id: string,
  partNo: string,
  basePrice: number | null,
  extra: Partial<ItemInput> = {},
): ItemInput => ({
  id,
  partNo,
  category: "05 MOTOR",
  name: "Motor",
  appliesTo: "",
  basePrice,
  sortOrder: 0,
  updatedAt: "2026-11-05T00:00:00.000Z",
  hidden: false,
  ...extra,
});
let seq = 0;
const quote = (
  itemId: string,
  company: string,
  effectiveDate: string,
  unitPrice: number,
  extra: Partial<QuoteInput> = {},
): QuoteInput => ({
  id: `q${++seq}`,
  itemId,
  company,
  unitPrice,
  effectiveDate,
  note: "",
  createdAt: `2026-11-05T00:00:00.${String(seq).padStart(3, "0")}Z`,
  hidden: false,
  ...extra,
});

const TODAY = "2026-11-05";

describe("파트넘버 검색 (친구 normalize 그대로)", () => {
  it("공백·하이픈 무시, 대소문자 무시", () => {
    expect(partKey("xx-05 a-01")).toBe("XX05A01");
    expect(
      matchesQuery({ partNo: "VX-05-A-01", name: "Motor" }, "05-a-01"),
    ).toBe(true);
    expect(matchesQuery({ partNo: "VX-05-A-01", name: "Motor" }, "motor")).toBe(
      true,
    );
  });
  it("숫자만 치면 파트넘버 숫자만 모아 비교 (0501 → VX-05-A-01)", () => {
    expect(matchesQuery({ partNo: "VX-05-A-01", name: "Motor" }, "0501")).toBe(
      true,
    );
    expect(matchesQuery({ partNo: "VX-07-A-01", name: "Board" }, "0501")).toBe(
      false,
    );
  });
});

describe("출장지별 가장 최근 단가", () => {
  it("같은 출장지는 최근 적용일 1개, 적용 예정·숨김 제외", () => {
    const qs = [
      quote("a", "가상정수센터", "2026-02-15", 480000),
      quote("a", "가상정수센터", "2026-09-05", 500000),
      quote("a", "가상정수센터", "2026-12-01", 900000),
      quote("a", "가상발전소", "2026-06-01", 560000, { hidden: true }),
    ];
    const latest = latestByCompany(qs, TODAY);
    expect([...latest.keys()]).toEqual(["가상정수센터"]);
    expect(latest.get("가상정수센터")!.unitPrice).toBe(500000);
  });
});

describe("평균·최저·최고 (평균은 원 단위 반올림)", () => {
  it("값", () => {
    expect(priceStats([300000, 350000, 320000])).toEqual({
      count: 3,
      average: 323333,
      min: 300000,
      max: 350000,
      range: 50000,
    });
    expect(priceStats([])).toEqual({
      count: 0,
      average: null,
      min: null,
      max: null,
      range: null,
    });
  });
});

describe("기준값 대비 차이율", () => {
  it("소수 1자리 반올림, 10% 이상 낮으면 크게 낮음", () => {
    expect(compareToBase(500000, 560000)).toEqual({
      diff: 60000,
      diffRate: 12,
      low: false,
    });
    expect(compareToBase(500000, 450000)).toEqual({
      diff: -50000,
      diffRate: -10,
      low: true,
    });
    expect(compareToBase(300000, 299000)).toEqual({
      diff: -1000,
      diffRate: -0.3,
      low: false,
    });
  });
  it("기준값이 없거나 0원이면 계산하지 않음", () => {
    expect(compareToBase(null, 1000)).toEqual({
      diff: null,
      diffRate: null,
      low: false,
    });
    expect(compareToBase(0, 1000)).toEqual({
      diff: null,
      diffRate: null,
      low: false,
    });
  });
  it("반올림은 0에서 먼 쪽", () => {
    expect(round1(0.25)).toBe(0.3);
    expect(round1(-0.25)).toBe(-0.3);
  });
});

// 친구 앱 VIRTUAL_CATALOG·VIRTUAL_COMPANY_PRICES 일부. 친구 앱은 기준값 = 기준단가 × (1 − 0%) + 0원 (기본값) → 여기서는 기준단가 그대로와 같다
const ITEMS = [
  item("a", "VX-01-A-00", 300000, { category: "01 현장서비스" }),
  item("b", "VX-05-A-01", 500000),
  item("c", "VX-07-A-01", 900000, { category: "07 BOARD" }),
  item("d", "VX-10-A-01", null, { category: "10 ETC" }),
];
const QUOTES = [
  quote("a", "가상정수센터", "2026-03-10", 300000),
  quote("a", "가상발전소", "2026-05-02", 350000),
  quote("a", "가상플랜트", "2026-08-20", 320000),
  quote("b", "가상정수센터", "2026-02-15", 480000),
  quote("b", "가상발전소", "2026-06-01", 560000),
  quote("b", "가상정수센터", "2026-09-05", 500000),
  quote("c", "가상가스", "2026-04-12", 950000),
  quote("c", "가상플랜트", "2026-07-07", 870000),
  quote("d", "가상가스", "2026-07-07", 10000),
];

describe("부품별 비교 표", () => {
  it("출장지 수·평균·최저·최고", () => {
    const rows = itemRows(ITEMS, QUOTES, TODAY);
    expect(
      rows.map((r) => [
        r.partNo,
        r.stats.count,
        r.stats.average,
        r.stats.min,
        r.stats.max,
      ]),
    ).toEqual([
      ["VX-01-A-00", 3, 323333, 300000, 350000],
      ["VX-05-A-01", 2, 530000, 500000, 560000],
      ["VX-07-A-01", 2, 910000, 870000, 950000],
      ["VX-10-A-01", 1, 10000, 10000, 10000],
    ]);
  });
  it("상세: 최신 적용일 순, 비교 기준 표시, 이전 단가는 비교 기준 아님", () => {
    const rows = itemQuotes(ITEMS[1], QUOTES, TODAY);
    expect(
      rows.map((r) => [r.company, r.effectiveDate, r.latest, r.diffRate]),
    ).toEqual([
      ["가상정수센터", "2026-09-05", true, 0],
      ["가상발전소", "2026-06-01", true, 12],
      ["가상정수센터", "2026-02-15", false, -4],
    ]);
  });
});

describe("출장지별 비교", () => {
  it("평균 차이율 = 부품 차이율 단순 평균, 기준값 없는 부품 제외, 평균 높은 순", () => {
    const { companies, lowCount } = companyComparison(ITEMS, QUOTES, TODAY);
    // 발전소 (16.7 + 12) ÷ 2 = 14.35 → 14.4 / 가스 VX-07 5.6 (VX-10 은 기준값 없음 → 빠짐) / 플랜트 (6.7 − 3.3) ÷ 2 = 1.7 / 정수센터 0
    expect(
      companies.map((c) => [
        c.company,
        c.count,
        c.averageRate,
        c.above,
        c.below,
        c.low,
      ]),
    ).toEqual([
      ["가상발전소", 2, 14.4, 2, 0, 0],
      ["가상가스", 1, 5.6, 1, 0, 0],
      ["가상플랜트", 2, 1.7, 1, 1, 0],
      ["가상정수센터", 2, 0, 0, 0, 0],
    ]);
    expect(lowCount).toBe(0);
  });
  it("크게 낮음 건수", () => {
    const { companies, lowCount } = companyComparison(
      ITEMS,
      [...QUOTES, quote("c", "가상할인", "2026-10-01", 800000)],
      TODAY,
    );
    expect(companies.find((c) => c.company === "가상할인")).toMatchObject({
      averageRate: -11.1,
      low: 1,
    });
    expect(lowCount).toBe(1);
  });
  it("숨긴 부품은 빠짐", () => {
    const { companies } = companyComparison(
      [{ ...ITEMS[0], hidden: true }],
      QUOTES,
      TODAY,
    );
    expect(companies).toEqual([]);
  });
});
