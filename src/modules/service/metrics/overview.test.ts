// 서비스팀 집계 — 친구 저장소 backend/service/tests/test_dashboard.py 와 같은 규칙인지 손계산으로 고정
import { describe, expect, it } from "vitest";

import { serviceOverview, type ReportRow } from "./overview";

const report = (over: Partial<ReportRow>): ReportRow => ({
  billing: null,
  productQuantities: [],
  sample: false,
  ...over,
});

describe("팀별 현황 서비스 카드", () => {
  it("출장 1건 = 보고서 1건, 유상 비율은 미입력 제외, 제품은 입력된 수량만", () => {
    const o = serviceOverview([
      report({ billing: "PAID", productQuantities: [1, 2] }),
      report({ billing: "PAID", productQuantities: [null] }),
      report({ billing: "PAID" }),
      report({ billing: "FREE", productQuantities: [3] }),
      report({ billing: null, productQuantities: [1] }),
    ]);
    expect(o).toEqual({
      trips: 5,
      paid: 3,
      free: 1,
      billingUnset: 1,
      paidRatio: 0.75,
      productQuantity: 7,
      hasSample: false,
    });
  });

  it("유상·무상 모두 없으면 비율 null (0%로 쓰지 않음)", () => {
    expect(serviceOverview([report({})]).paidRatio).toBeNull();
    expect(serviceOverview([]).trips).toBe(0);
  });

  it("시드 보고서가 있으면 hasSample", () => {
    expect(serviceOverview([report({ sample: true })]).hasSample).toBe(true);
  });
});
