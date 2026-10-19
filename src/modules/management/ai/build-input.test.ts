import { describe, expect, it } from "vitest";

import { computeManagementSummary } from "../metrics/summary";
import { date, financeMonth, receivable } from "../metrics/test-fixtures";
import { buildAiInput } from "./build-input";
import { hashAiInput, stableStringify } from "./hash";
import { mockAiComment } from "./mock-comment";
import { buildUserMessage } from "./prompt";
import type { QuarterPeriod } from "./rules";
import { aiCommentResultSchema } from "./schemas";

const q3: QuarterPeriod = { unit: "quarter", year: 2026, quarter: 3 };
const sales = (amount: bigint) => ({
  productSales: amount,
  operatingExpense: amount / 2n,
});

function summaryFor(
  overrides: {
    today?: string;
    sep?: "CONFIRMED" | "DRAFT";
    amount?: bigint;
  } = {},
) {
  return computeManagementSummary({
    period: q3,
    financeMonths: [
      financeMonth(2026, 4, sales(200_000_000n)),
      financeMonth(2026, 5, sales(200_000_000n)),
      financeMonth(2026, 6, sales(200_000_000n)),
      financeMonth(2026, 7, sales(overrides.amount ?? 300_000_000n)),
      financeMonth(2026, 8, sales(300_000_000n)),
      financeMonth(2026, 9, {
        ...sales(300_000_000n),
        status: overrides.sep ?? "DRAFT",
      }),
    ],
    annualTarget: {
      year: 2026,
      revenueTarget: 4_000_000_000n,
      quarterTargets: [null, null, null, null],
    },
    receivables: [
      receivable("r1", {
        customerName: "비밀거래처(가상)",
        note: "대표 친척 회사",
        occurredOn: date("2026-05-01"),
        amount: 50_000_000n,
        dueOn: date("2026-07-31"),
      }),
      receivable("r2", {
        customerName: "다른거래처(가상)",
        occurredOn: date("2026-09-15"),
        amount: 10_000_000n,
      }),
    ],
    today: date(overrides.today ?? "2026-10-17"),
  });
}

describe("buildAiInput", () => {
  const input = buildAiInput(summaryFor(), q3);
  const text = JSON.stringify(input);

  it("거래처명·비고·건별 id 는 보내지 않는다", () => {
    expect(text).not.toContain("비밀거래처");
    expect(text).not.toContain("다른거래처");
    expect(text).not.toContain("대표 친척");
    expect(text).not.toContain('"r1"');
  });

  it("미수금은 금액·건수·구간만", () => {
    expect(input.receivables).toMatchObject({
      asOf: "2026-09-30",
      total: "60,000,000원",
      count: 2,
      pastDue: { amount: "50,000,000원", count: 1 },
      noDueDate: { amount: "10,000,000원", count: 1 },
    });
    expect(input.receivables.aging).toContainEqual({
      bucket: "90일 초과",
      amount: "50,000,000원",
      count: 1,
    });
  });

  it("미확정 월과 같은 월끼리 비교 범위를 전달", () => {
    expect(input.confirmation).toEqual({
      confirmedMonths: "2026년 7월, 2026년 8월",
      unconfirmedMonths: [{ month: "2026년 9월", reason: "임시저장(미확정)" }],
      partial: true,
    });
    expect(input.changes.previousQuarter).toMatchObject({
      basePeriod: "2026년 2분기",
      sameMonthsOnly: {
        current: "2026년 7월, 2026년 8월",
        base: "2026년 4월, 2026년 5월",
      },
      revenue: "+50.0%",
    });
    // 전년 데이터 없음 → 숫자를 만들지 않고 이유를 적는다
    expect(input.changes.sameQuarterLastYear.revenue).toBe(
      "비교 불가 (비교 기간 확정 데이터 없음)",
    );
  });

  it("목표 달성률·진도 (분기 말 기준)", () => {
    expect(input.target).toMatchObject({
      quarterTarget: "1,000,000,000원",
      quarterTargetSource: "연간 목표에서 자동 배분",
      quarterActual: "600,000,000원",
      quarterAchievement: "60.0%",
      annualTarget: "4,000,000,000원",
      cumulativeActualToQuarterEnd: "1,200,000,000원",
      annualAchievement: "30.0%",
      elapsedRatio: "75%",
      progressGap: "-45.0%p (연간 달성률 − 경과율)",
    });
  });

  it("지출 비중", () => {
    expect(input.expense.total).toBe("300,000,000원");
    expect(input.expense.items).toContainEqual({
      item: expect.any(String),
      amount: "300,000,000원",
      share: "100.0%",
    });
  });

  it("끝난 분기는 오늘 날짜가 바뀌어도 같은 해시, 데이터가 바뀌면 다른 해시", () => {
    const base = hashAiInput(input);
    expect(
      hashAiInput(buildAiInput(summaryFor({ today: "2026-12-31" }), q3)),
    ).toBe(base);
    expect(
      hashAiInput(buildAiInput(summaryFor({ sep: "CONFIRMED" }), q3)),
    ).not.toBe(base);
    expect(
      hashAiInput(buildAiInput(summaryFor({ amount: 300_000_001n }), q3)),
    ).not.toBe(base);
  });

  it("사용자 메시지에 JSON 이 그대로 들어간다", () => {
    const message = buildUserMessage(input);
    expect(message).toContain("2026년 3분기");
    expect(message).toContain('"unconfirmedMonths"');
  });

  it("모의 응답도 응답 형식을 지키고 미확정 월을 언급한다", () => {
    const mock = aiCommentResultSchema.parse(mockAiComment(input));
    expect(mock.summary).toContain("2026년 9월");
    expect(mock.summary).toContain("[모의 응답]");
  });
});

describe("stableStringify", () => {
  it("키 순서와 무관, 배열 순서는 유지", () => {
    expect(stableStringify({ b: 1, a: { d: [2, 1], c: null } })).toBe(
      stableStringify({ a: { c: null, d: [2, 1] }, b: 1 }),
    );
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});

describe("aiCommentResultSchema", () => {
  it("요약 필수, 목록은 최대 3개", () => {
    const ok = { summary: "요약", weaknesses: [], improvements: ["a"] };
    expect(aiCommentResultSchema.safeParse(ok).success).toBe(true);
    expect(
      aiCommentResultSchema.safeParse({ ...ok, summary: "  " }).success,
    ).toBe(false);
    expect(
      aiCommentResultSchema.safeParse({
        ...ok,
        weaknesses: ["1", "2", "3", "4"],
      }).success,
    ).toBe(false);
  });
});
