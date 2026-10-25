import { describe, expect, it } from "vitest";

import { parseExportPeriod } from "../../export/period";
import { planEntrySheets } from "./plan";
import { SAMPLE_CATEGORIES, SAMPLE_MONTHS } from "./test-data";

const Q3 = [7, 8, 9].map((month) => ({ year: 2026, month }));

const plan = (param: string, months = Q3, data = SAMPLE_MONTHS) =>
  planEntrySheets({
    period: parseExportPeriod(param)!,
    months,
    data,
    categories: SAMPLE_CATEGORIES,
  });

describe("월간 입력 다운로드 시트 구성", () => {
  it("분기: 합계 시트 먼저 + 데이터 있는 달(임시저장 포함)", () => {
    expect(plan("2026-Q3").map((s) => [s.sheetName, s.kind])).toEqual([
      ["2026-Q3", "total"],
      ["2026-07", "month"],
      ["2026-08", "month"],
      ["2026-09", "month"],
    ]);
  });

  it("합계 = 확정된 달만 (9월 임시저장 제외), H2 에 제외한 달을 빨간 글씨로", () => {
    const [total] = plan("2026-Q3");
    expect(total.values.operatingExpense).toBe(32_910_000 + 33_648_000);
    expect(total.values.productSales).toBe(182_400_000 + 168_900_000);
    expect(total.status).toEqual({
      text: "집계: 확정된 달만 (7·8월)",
      warn: false,
    });
    expect(total.status2).toEqual({ text: "제외: 9월 임시저장", warn: true });
    expect(total.titleSuffix).toBe("(2026년 3분기 합계)");
    expect(total.memoLabel).toBe("3분기");
  });

  it("그 외 지출: 사용 중 항목 + 비활성이지만 금액 있는 항목(협회비), 정렬 순서대로", () => {
    const [total, july, august] = plan("2026-Q3");
    expect(total.others.map((o) => [o.name, o.amount, o.inactive])).toEqual([
      ["광고선전비", 4_500_000, false],
      ["접대비", 3_270_000, false],
      ["차량유지비", 1_800_000, false],
      ["복리후생비", 2_600_000, false],
      ["지급수수료", 260_000, false],
      ["협회비", 500_000, true],
    ]);
    expect(july.others.at(-1)).toEqual({
      name: "협회비",
      amount: 500_000,
      inactive: true,
    });
    // 8월엔 협회비 0원 → 비활성 항목은 보이지 않음
    expect(august.others.map((o) => o.name)).not.toContain("협회비");
  });

  it("월 시트 상태: 확정일은 한국 날짜, 임시저장·입력 없음은 빨간 글씨", () => {
    const sheets = plan("2026-Q3");
    expect(sheets[2].status).toEqual({
      text: "상태: 확정 (2026-09-01)",
      warn: false,
    });
    expect(sheets[3].status).toEqual({
      text: "상태: 임시저장 (확정 전 — 대시보드 합계 제외)",
      warn: true,
    });
    const [empty] = plan("2026-10", [{ year: 2026, month: 10 }]);
    expect(empty).toMatchObject({
      sheetName: "2026-10",
      status: { text: "상태: 입력 없음", warn: true },
    });
    expect(empty.values.productSales).toBeNull();
    expect(empty.others.every((o) => o.amount === null)).toBe(true);
  });

  it("확정된 달이 하나도 없으면 합계는 빈칸 + '확정된 달 없음'", () => {
    const [total] = plan("2026-Q3", Q3, [SAMPLE_MONTHS[2]]);
    expect(total.values.productSales).toBeNull();
    expect(total.status).toEqual({ text: "집계: 확정된 달 없음", warn: true });
    expect(total.status2?.text).toBe(
      "제외: 7월 입력 없음 · 8월 입력 없음 · 9월 임시저장",
    );
  });

  it("연초 누적: 시트 이름 2026-01~10, 메모 1~10월", () => {
    const [total] = plan(
      "2026-YTD10",
      Array.from({ length: 10 }, (_, i) => ({ year: 2026, month: i + 1 })),
    );
    expect(total).toMatchObject({
      sheetName: "2026-01~10",
      memoLabel: "1~10월",
      titleSuffix: "(2026년 1~10월 합계)",
    });
  });
});
