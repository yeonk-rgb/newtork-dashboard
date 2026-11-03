// 생산팀 집계 — 친구 저장소 backend/production/tests/test_dashboard.py 와 같은 규칙인지 손계산으로 고정
import { describe, expect, it } from "vitest";

import { OTHER_SERIES_KEY } from "@/shared/contracts/production";
import type { Period } from "@/shared/period/period";

import {
  MAX_SERIES_SLICES,
  periodTarget,
  productionOverview,
  salesShareByIndustry,
  salesShareBySeries,
  type ProductionTargets,
  type RecordRow,
} from "./sales-share";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
let serial = 0;
const row = (over: Partial<RecordRow>): RecordRow => ({
  sheetName: "2026",
  serialNo: String(++serial).padStart(4, "0"),
  orderNo: "",
  modelCode: "02",
  shippedDate: null,
  dueDate: null,
  quantity: 1,
  sample: false,
  ...over,
});

const Q3: Period = { unit: "quarter", year: 2026, quarter: 3 };

describe("산업분야별 확정 출고 수량", () => {
  const categories = new Map([
    ["26001", "WATER"],
    ["26002", "POWER"],
  ]);
  const rows = [
    row({ orderNo: "26001", shippedDate: d("2026-07-01"), quantity: 2 }),
    row({ orderNo: "26001", shippedDate: d("2026-09-30"), quantity: 3 }),
    row({ orderNo: "26002", shippedDate: d("2026-08-15"), quantity: 1 }),
    // 미분류 (사업구분 없음·수주번호 없음)
    row({ orderNo: "26099", shippedDate: d("2026-08-01"), quantity: 4 }),
    row({ orderNo: "", shippedDate: d("2026-08-02"), quantity: 1 }),
    // 수량 미확정 → 합계에 넣지 않고 행 수만
    row({ orderNo: "26001", shippedDate: d("2026-08-03"), quantity: null }),
    // 기간 밖·출고일 없음 → 제외
    row({ orderNo: "26001", shippedDate: d("2026-10-01"), quantity: 9 }),
    row({ orderNo: "26001", shippedDate: d("2026-06-30"), quantity: 9 }),
    row({ orderNo: "26001", shippedDate: null, dueDate: d("2026-08-01") }),
  ];

  it("출고일자 기준·확정 수량만, 미분류는 따로, 수량 큰 순", () => {
    const r = salesShareByIndustry(rows, categories, Q3);
    expect(r.items).toEqual([
      { key: "WATER", label: "상하수도", amount: 0n, quantity: 5 },
      { key: "POWER", label: "발전소", amount: 0n, quantity: 1 },
    ]);
    expect(r).toMatchObject({
      source: "production",
      basis: "quantity",
      unconfirmedRows: 1,
      unclassifiedQuantity: 5,
      hasSample: false,
    });
  });

  it("데이터가 없으면 빈 목록 (에러 아님)", () => {
    const r = salesShareByIndustry([], categories, Q3);
    expect(r.items).toEqual([]);
    expect(r.unconfirmedRows).toBe(0);
  });

  it("시드 행이 기간 안에 있으면 hasSample", () => {
    const r = salesShareByIndustry(
      [row({ shippedDate: d("2026-07-10"), sample: true })],
      categories,
      Q3,
    );
    expect(r.hasSample).toBe(true);
  });
});

describe("제품(모델명)별 확정 출고 수량", () => {
  it("모델명 원본 값 그대로, 빈 모델명은 '(모델명 없음)'", () => {
    const r = salesShareBySeries(
      [
        row({ modelCode: "01", shippedDate: d("2026-07-01"), quantity: 2 }),
        row({ modelCode: "02", shippedDate: d("2026-07-01"), quantity: 5 }),
        row({ modelCode: "", shippedDate: d("2026-07-01"), quantity: 1 }),
      ],
      Q3,
    );
    expect(r.items.map((i) => [i.key, i.label, i.quantity])).toEqual([
      ["02", "02", 5],
      ["01", "01", 2],
      ["", "(모델명 없음)", 1],
    ]);
  });

  it(`모델이 ${MAX_SERIES_SLICES}개를 넘으면 상위 ${MAX_SERIES_SLICES - 1}개 + 기타 모델`, () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row({
        modelCode: `0${i + 1}`,
        shippedDate: d("2026-08-01"),
        quantity: 10 - i,
      }),
    );
    const r = salesShareBySeries(rows, Q3);
    expect(r.items).toHaveLength(MAX_SERIES_SLICES);
    expect(r.items.at(-1)).toEqual({
      key: OTHER_SERIES_KEY,
      label: "기타 모델 3개",
      amount: 0n,
      quantity: 5 + 4 + 3,
    });
    const total = r.items.reduce((n, i) => n + i.quantity, 0);
    expect(total).toBe(rows.reduce((n, x) => n + x.quantity!, 0));
  });
});

describe("기간 목표", () => {
  const targets: ProductionTargets = {
    annual: 300,
    monthly: new Map([
      [7, 20],
      [8, 25],
      [9, 30],
      [10, 28],
    ]),
  };
  it("분기 = 3개월 합(모두 있을 때만), 월 = 그 달, 연간 = 연간 목표", () => {
    expect(periodTarget(Q3, targets)).toEqual({ target: 75, note: null });
    expect(
      periodTarget({ unit: "month", year: 2026, month: 10 }, targets),
    ).toEqual({ target: 28, note: null });
    expect(periodTarget({ unit: "year", year: 2026 }, targets)).toEqual({
      target: 300,
      note: null,
    });
  });
  it("일부 월만 있으면 목표 없음 + 안내", () => {
    expect(
      periodTarget({ unit: "quarter", year: 2026, quarter: 4 }, targets),
    ).toEqual({ target: null, note: "월 목표 1/3개월만 입력" });
    expect(
      periodTarget({ unit: "month", year: 2026, month: 11 }, targets),
    ).toEqual({ target: null, note: "월 목표 미설정" });
    expect(
      periodTarget(
        { unit: "year", year: 2026 },
        { annual: null, monthly: new Map() },
      ),
    ).toEqual({ target: null, note: "연간 목표 미설정" });
  });
});

describe("팀별 현황 생산 카드", () => {
  it("확정 출고 수량·달성률·납기 일정(같은 납기일 + 같은 수주번호 = 1건)", () => {
    const rows = [
      // 26001 9/15 일정: 2대 중 1대 출고 전 → 출고 대기
      row({
        orderNo: "26001",
        dueDate: d("2026-09-15"),
        shippedDate: d("2026-09-14"),
        quantity: 2,
      }),
      row({ orderNo: "26001", dueDate: d("2026-09-15"), shippedDate: null }),
      // 26002 같은 날 다른 수주번호 → 별도 1건, 모두 출고
      row({
        orderNo: "26002",
        dueDate: d("2026-09-15"),
        shippedDate: d("2026-09-10"),
        quantity: null,
      }),
      // 수주번호 없음 → 일련번호 단위 1건씩
      row({
        orderNo: "",
        dueDate: d("2026-08-01"),
        shippedDate: d("2026-08-01"),
        quantity: 3,
      }),
      row({
        orderNo: "",
        dueDate: d("2026-08-01"),
        shippedDate: d("2026-08-01"),
        quantity: 1,
      }),
      // 납기가 기간 밖
      row({
        orderNo: "26003",
        dueDate: d("2026-10-02"),
        shippedDate: d("2026-09-30"),
        quantity: 4,
      }),
    ];
    const o = productionOverview(
      rows,
      {
        annual: null,
        monthly: new Map([
          [7, 10],
          [8, 10],
          [9, 10],
        ]),
      },
      Q3,
    );
    expect(o).toEqual({
      confirmedQuantity: 2 + 3 + 1 + 4,
      target: 30,
      targetNote: null,
      achievement: 10 / 30,
      unconfirmedRows: 1,
      dueEvents: 4,
      dueEventsPending: 1,
      hasSample: false,
    });
  });
});
