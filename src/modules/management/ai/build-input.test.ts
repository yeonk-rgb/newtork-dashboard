import { describe, expect, it } from "vitest";

import { computeManagementSummary } from "../metrics/summary";
import { date, financeMonth, receivable } from "../metrics/test-fixtures";
import { buildAiInput } from "./build-input";
import { hashAiInput, stableStringify } from "./hash";
import { mockAiComment } from "./mock-comment";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import type { QuarterPeriod } from "./rules";
import { normalizeAiComment, SENTENCE_PROMPT_MAX } from "./schemas";

const q3: QuarterPeriod = { unit: "quarter", year: 2026, quarter: 3 };
const sales = (amount: bigint) => ({
  productSales: amount,
  operatingExpense: amount / 2n,
});

/**
 * 기본: 2026 3분기, 9월 임시저장(미확정), 전년(2025 3분기) 데이터 없음
 * - allConfirmed: 9월도 확정 / withLastYear: 2025 3분기 데이터 추가 / july: 7월 매출
 */
function summaryFor(
  options: {
    today?: string;
    allConfirmed?: boolean;
    withLastYear?: boolean;
    july?: bigint;
  } = {},
) {
  const lastYear = options.withLastYear
    ? [7, 8, 9].map((m) => financeMonth(2025, m, sales(250_000_000n)))
    : [];
  return computeManagementSummary({
    period: q3,
    financeMonths: [
      ...lastYear,
      financeMonth(2026, 4, sales(200_000_000n)),
      financeMonth(2026, 5, sales(200_000_000n)),
      financeMonth(2026, 6, sales(200_000_000n)),
      financeMonth(2026, 7, sales(options.july ?? 300_000_000n)),
      financeMonth(2026, 8, sales(300_000_000n)),
      financeMonth(2026, 9, {
        ...sales(300_000_000n),
        status: options.allConfirmed ? "CONFIRMED" : "DRAFT",
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
    today: date(options.today ?? "2026-10-19"),
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

  it("산업분야·제품 시리즈(목업)는 연동 전까지 넣지 않는다", () => {
    expect(text).not.toContain("is_sample");
    expect(text).not.toContain("industry");
    expect(text).not.toContain("series");
  });

  it("금액은 억·만 원 단위", () => {
    expect(input.revenue.total).toBe("6억 원");
    expect(input.expense.total).toBe("3억 원");
    expect(input.receivables).toMatchObject({
      asOf: "2026-09-30",
      total: "6,000만 원",
      count: 2,
      pastDue: { amount: "5,000만 원", count: 1 },
      noDueDate: { amount: "1,000만 원", count: 1 },
    });
    expect(input.receivables.aging).toContainEqual({
      bucket: "90일 초과",
      amount: "5,000만 원",
      count: 1,
    });
  });

  it("[미확정 월 있는 분기] 미확정 달과 같은 월끼리 비교 범위를 전달", () => {
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
    // 항목별 증감은 내부 key 대신 한글 이름으로
    expect(input.changes.previousQuarter.revenueByItem).toEqual({
      "제품 매출": "+50.0%",
      "상품 매출": "비교 불가 (비교 기간 값이 0원)",
      "용역 매출": "비교 불가 (비교 기간 값이 0원)",
    });
  });

  it("[전년 데이터 없는 분기] 숫자 대신 '비교 불가'와 이유", () => {
    expect(input.changes.sameQuarterLastYear).toMatchObject({
      revenue: "비교 불가 (비교 기간 확정 데이터 없음)",
      profit: "비교 불가 (비교 기간 확정 데이터 없음)",
      marginDiff: "비교 불가 (비교 기간 확정 데이터 없음)",
    });
  });

  it("목표 미달: 달성률·부족 %p·부족 금액·연간 진도를 미리 계산", () => {
    expect(input.target).toMatchObject({
      quarterTarget: "10억 원",
      quarterTargetSource: "연간 목표에서 자동 배분",
      quarterActual: "6억 원",
      quarterAchievement: "60.0%로 40.0%p 부족",
      quarterDifference: "4억 원 부족",
      annualTarget: "40억 원",
      cumulativeActualToQuarterEnd: "12억 원",
      annualProgress: "연간 달성률 30.0%로 경과율 75.0% 대비 45.0%p 뒤처짐",
    });
  });

  it("목표 초과: '초과'로 표시", () => {
    const over = buildAiInput(
      summaryFor({ allConfirmed: true, july: 500_000_000n }),
      q3,
    );
    expect(over.target).toMatchObject({
      quarterActual: "11억 원",
      quarterAchievement: "110.0%로 10.0%p 초과",
      quarterDifference: "1억 원 초과",
    });
  });

  it("[모두 확정 + 전년 있음] 미확정 없음, 전년 대비 숫자", () => {
    const full = buildAiInput(
      summaryFor({ allConfirmed: true, withLastYear: true }),
      q3,
    );
    expect(full.confirmation.unconfirmedMonths).toEqual([]);
    expect(full.changes.previousQuarter.sameMonthsOnly).toBeNull();
    expect(full.changes.sameQuarterLastYear.revenue).toBe("+20.0%");
  });

  it("끝난 분기는 오늘 날짜가 바뀌어도 같은 해시, 데이터가 바뀌면 다른 해시", () => {
    const base = hashAiInput(input);
    expect(
      hashAiInput(buildAiInput(summaryFor({ today: "2026-12-31" }), q3)),
    ).toBe(base);
    expect(
      hashAiInput(buildAiInput(summaryFor({ allConfirmed: true }), q3)),
    ).not.toBe(base);
    expect(
      hashAiInput(buildAiInput(summaryFor({ july: 300_010_000n }), q3)),
    ).not.toBe(base);
  });

  it("사용자 메시지에 JSON 이 그대로 들어간다", () => {
    const message = buildUserMessage(input);
    expect(message).toContain("2026년 3분기");
    expect(message).toContain('"unconfirmedMonths"');
  });
});

describe("SYSTEM_PROMPT", () => {
  it("요청 규칙 1~10번, 회사 설명, 60자 제한", () => {
    expect(SYSTEM_PROMPT).toContain("전동밸브조작기 제조사(직원 12명)");
    for (let n = 1; n <= 10; n += 1) {
      expect(SYSTEM_PROMPT).toContain(`\n${n}. `);
    }
    expect(SYSTEM_PROMPT).toContain("한 문장은 60자 이내");
    expect(SYSTEM_PROMPT).toContain("is_sample");
  });
});

describe("mockAiComment (프롬프트 9·10번 규칙 확인용)", () => {
  const sentences = (r: ReturnType<typeof mockAiComment>) => [
    ...r.summary,
    ...r.shortfalls,
    ...r.improvements,
  ];

  it("[미확정 월 + 전년 없음] 9월 미확정을 언급, 전년은 숫자 없이 비교 불가", () => {
    const mock = mockAiComment(buildAiInput(summaryFor(), q3));
    expect(mock.summary[0]).toBe(
      "[모의] 분기 목표 대비 60.0%로 40.0%p 부족입니다.",
    );
    expect(mock.summary).toContain(
      "[모의] 9월은 미확정이라 집계에서 빠졌습니다.",
    );
    expect(mock.improvements).toContain(
      "[모의] 전년 동기는 데이터가 없어 비교할 수 없습니다.",
    );
    expect(mock.shortfalls).toContain(
      "[모의] 분기 매출이 목표보다 4억 원 부족합니다.",
    );
  });

  it("[모두 확정 + 전년 있음] 미확정 언급 없음, 전년 대비 숫자 사용", () => {
    const mock = mockAiComment(
      buildAiInput(summaryFor({ allConfirmed: true, withLastYear: true }), q3),
    );
    expect(sentences(mock).join(" ")).not.toContain("미확정");
    expect(mock.improvements[0]).toContain("+20.0%");
  });

  it("모의 응답도 문장 60자 이내, 저장 형식 통과", () => {
    for (const options of [{}, { allConfirmed: true, withLastYear: true }]) {
      const mock = mockAiComment(buildAiInput(summaryFor(options), q3));
      for (const s of sentences(mock)) {
        expect([...s].length).toBeLessThanOrEqual(SENTENCE_PROMPT_MAX);
      }
      expect(normalizeAiComment(mock)?.report).toEqual({
        truncated: 0,
        dropped: 0,
      });
    }
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
