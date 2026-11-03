// 생산 대시보드 집계 — 손계산으로 고정 (친구 저장소 test_dashboard.py 와 같은 규칙,
// 친구 앱 가짜 데이터 548행으로 54개 값 대조 0건 차이 — 2026-11-03)
import { describe, expect, it } from "vitest";

import {
  dueEventsByMonth,
  productionBreakdown,
  productionSummary,
  TOP_SELLERS,
} from "./dashboard";
import type { RecordRow } from "./sales-share";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
let seq = 0;
const row = (o: Partial<RecordRow>): RecordRow => ({
  sheetName: "2026",
  serialNo: String(++seq),
  orderNo: "",
  modelCode: "02",
  seller: "가상상사",
  shippedDate: null,
  dueDate: null,
  quantity: 1,
  sample: false,
  ...o,
});

const ROWS = [
  row({ shippedDate: d("2026-07-01"), quantity: 2, orderNo: "A" }),
  row({ shippedDate: d("2026-08-10"), quantity: null, orderNo: "A" }),
  row({
    shippedDate: d("2026-09-30"),
    quantity: 3,
    orderNo: "B",
    seller: "나상사",
    modelCode: "04",
  }),
  row({ shippedDate: d("2026-01-05"), quantity: 1 }),
  row({ shippedDate: d("2025-12-31"), quantity: 9 }), // 다른 해
  row({ shippedDate: null, dueDate: d("2026-07-15"), orderNo: "A" }), // 출고일 없음
];

describe("연간·분기·월 실적", () => {
  const targets = {
    annual: 100,
    monthly: new Map([
      [7, 5],
      [8, 5],
      [9, 5],
      [1, 10],
    ]),
  };
  const s = productionSummary(ROWS, targets, 2026);

  it("출고일자 기준, 확정 수량만 합하고 수량 빈 행은 미확정", () => {
    expect(s.annual).toMatchObject({
      target: 100,
      confirmed: 6,
      unconfirmed: 1,
      shortfall: 94,
      monthlyTargetSum: 25,
    });
    expect(s.annual.achievement).toBeCloseTo(0.06);
    expect(s.months[6]).toMatchObject({
      month: 7,
      target: 5,
      confirmed: 2,
      shortfall: 3,
    });
    expect(s.months[1]).toMatchObject({
      target: null,
      achievement: null,
      shortfall: null,
    });
  });

  it("분기 목표는 3개월 모두 있을 때만 — 아니면 입력된 개월 수", () => {
    expect(s.quarters[2]).toMatchObject({
      quarter: 3,
      target: 15,
      monthTargetsSet: 3,
      confirmed: 5,
      unconfirmed: 1,
    });
    expect(s.quarters[0]).toMatchObject({
      target: null,
      monthTargetsSet: 1,
      confirmed: 1,
    });
  });

  it("목표가 0이면 달성률 없음", () => {
    const zero = productionSummary(
      ROWS,
      { annual: 0, monthly: new Map() },
      2026,
    );
    expect(zero.annual).toMatchObject({
      achievement: null,
      shortfall: 0,
      monthlyTargetSum: null,
    });
  });
});

describe("분류별 판매량", () => {
  it("산업 분야는 7가지 모두 + 미분류(있을 때만), 판매처·모델은 확정 수량 큰 순", () => {
    const b = productionBreakdown(ROWS, new Map([["B", "WATER"]]), {
      year: 2026,
      quarter: 3,
    });
    expect(b.byCategory).toHaveLength(8);
    expect(b.byCategory[0]).toMatchObject({ key: "WATER", confirmed: 3 });
    expect(b.byCategory.at(-1)).toMatchObject({
      label: "미분류",
      confirmed: 2,
      unconfirmed: 1,
    });
    expect(b.bySeller.map((r) => [r.label, r.confirmed])).toEqual([
      ["나상사", 3],
      ["가상상사", 2],
    ]);
    expect(b.byModel.map((r) => r.label)).toEqual(["04", "02"]);
  });

  it("월을 고르면 그 달만 (수주번호 없는 행은 미분류)", () => {
    const b = productionBreakdown(
      ROWS,
      new Map([
        ["A", "GAS"],
        ["B", "GAS"],
      ]),
      { year: 2026, month: 1 },
    );
    expect(b.byCategory).toHaveLength(8);
    expect(b.byCategory.at(-1)).toMatchObject({
      label: "미분류",
      confirmed: 1,
    });
    expect(b.byCategory.slice(0, 7).every((r) => r.confirmed === 0)).toBe(true);
    expect(b.bySeller).toEqual([
      expect.objectContaining({ label: "가상상사", confirmed: 1 }),
    ]);
  });

  it(`판매처는 상위 ${TOP_SELLERS}곳 + 기타 N곳`, () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      row({
        shippedDate: d("2026-03-01"),
        seller: `판매처${String(i).padStart(2, "0")}`,
        quantity: 20 - i,
      }),
    );
    const b = productionBreakdown(many, new Map(), { year: 2026 });
    expect(b.bySeller).toHaveLength(TOP_SELLERS + 1);
    expect(b.bySeller.at(-1)).toMatchObject({
      label: "기타 2곳",
      confirmed: 10 + 9,
    });
  });
});

describe("납기 일정", () => {
  it("같은 납기일 + 같은 수주번호 = 1건, 수주번호 없으면 일련번호 단위, 출고 여부 무관", () => {
    const rows = [
      row({ dueDate: d("2026-01-15"), orderNo: "26006" }),
      row({
        dueDate: d("2026-01-15"),
        orderNo: "26006",
        shippedDate: d("2026-01-14"),
      }),
      row({ dueDate: d("2026-01-15"), orderNo: "26007" }),
      row({ dueDate: d("2026-01-30"), orderNo: "" }),
      row({ dueDate: d("2026-01-30"), orderNo: "" }),
      row({ dueDate: d("2027-01-01"), orderNo: "X" }),
    ];
    expect(dueEventsByMonth(rows, 2026).slice(0, 2)).toEqual([4, 0]);
  });
});
