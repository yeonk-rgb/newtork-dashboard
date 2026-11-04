import { describe, expect, it } from "vitest";

import { NO_TEAM_FACTS } from "@/shared/contracts/team-ai";

import { computeManagementSummary } from "../metrics/summary";
import { arEntry, date, financeMonth } from "../metrics/test-fixtures";

import { buildAiInput } from "./build-input";
import { hashAiInput, stableStringify } from "./hash";
import { mockAiComment } from "./mock-comment";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import type { QuarterPeriod } from "./rules";
import { normalizeAiComment, SENTENCE_PROMPT_MAX } from "./schemas";

const q3: QuarterPeriod = { unit: "quarter", year: 2026, quarter: 3 };
/** 매출 + 경비(매출의 절반) + 상품·원재료 매입(각 매출의 10%) */
const sales = (amount: bigint) => ({
  productSales: amount,
  operatingExpense: amount / 2n,
  goodsPurchase: amount / 10n,
  materialPurchase: amount / 10n,
});

/**
 * 기본: 2026 3분기, 9월 임시저장(미확정), 전년(2025 3분기) 데이터 없음
 * - allConfirmed: 9월도 확정 / withLastYear: 2025 3분기 추가 / noPrevQuarter: 2분기(직전 분기) 없음
 * - july: 7월 매출
 */
function summaryFor(
  options: {
    today?: string;
    allConfirmed?: boolean;
    withLastYear?: boolean;
    noPrevQuarter?: boolean;
    july?: bigint;
  } = {},
) {
  const lastYear = options.withLastYear
    ? [7, 8, 9].map((m) => financeMonth(2025, m, sales(250_000_000n)))
    : [];
  const prevQuarter = options.noPrevQuarter
    ? []
    : [4, 5, 6].map((m) => financeMonth(2026, m, sales(200_000_000n)));
  return computeManagementSummary({
    period: q3,
    financeMonths: [
      ...lastYear,
      ...prevQuarter,
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
    // 2026년 9월 경영지원 관리 외상매출금 (대시보드 미수금 기준)
    receivables: [
      arEntry("r1", {
        status: "LONG_OVERDUE",
        partnerName: "비밀거래처(가상)",
        note: "대표 친척 회사",
        amount: 50_000_000n,
        dueOn: date("2026-07-31"),
      }),
      arEntry("r2", {
        partnerName: "다른거래처(가상)",
        amount: 10_000_000n,
        dueOn: date("2026-09-10"),
      }),
      arEntry("r3", {
        status: "COLLECTED",
        partnerName: "받은거래처(가상)",
        amount: 3_000_000n,
      }),
    ],
    today: date(options.today ?? "2026-10-20"),
  });
}

describe("buildAiInput", () => {
  const input = buildAiInput(summaryFor(), q3);
  const text = JSON.stringify(input);

  it("거래처명·비고·건별 id 는 보내지 않는다", () => {
    expect(text).not.toContain("비밀거래처");
    expect(text).not.toContain("다른거래처");
    expect(text).not.toContain("받은거래처");
    expect(text).not.toContain("대표 친척");
    expect(text).not.toContain('"r1"');
  });

  it("팀 숫자를 넘기지 않으면 teams 칸이 없다 (옛 입력과 해시 같음)", () => {
    expect(text).not.toContain("is_sample");
    expect(input).not.toHaveProperty("teams");
    expect(buildAiInput(summaryFor(), q3, NO_TEAM_FACTS)).not.toHaveProperty(
      "teams",
    );
  });

  it("생산·서비스 숫자 — 팀별 현황 카드와 같은 값, 문장에 쓸 표기로 (2026-11-04)", () => {
    const share = (items: [string, number][], hasSample = true) => ({
      items: items.map(([label, quantity]) => ({
        key: label,
        label,
        amount: 0n,
        quantity,
      })),
      source: "production" as const,
      basis: "quantity" as const,
      unconfirmedRows: 2,
      unclassifiedQuantity: 3,
      hasSample,
    });
    const withTeams = buildAiInput(summaryFor(), q3, {
      production: {
        confirmedQuantity: 71,
        target: 84,
        targetNote: null,
        achievement: 71 / 84,
        shortfall: 13,
        unconfirmedRows: 2,
        dueEvents: 23,
        dueEventsPending: 4,
        hasSample: true,
      },
      industry: share([
        ["상하수도", 30],
        ["발전소", 10],
        ["가스", 0],
      ]),
      series: share([["02", 40]]),
      service: {
        trips: 18,
        paid: 11,
        free: 5,
        billingUnset: 2,
        paidRatio: 11 / 16,
        productQuantity: 30,
        topRegion: { label: "경상남도 창원시", trips: 4, ratio: 4 / 18 },
        regionUnassigned: 2,
        topParts: [
          { name: "Motor", reports: 5 },
          { name: "Bearing", reports: 3 },
        ],
        hasSample: true,
      },
    });
    expect(withTeams.teams?.production).toMatchObject({
      is_sample: true,
      confirmedShipped: "71대",
      target: "84대",
      achievement: "84.5%로 15.5%p 부족",
      shortfall: "13대",
    });
    expect(withTeams.teams?.production?.dueNotShipped).toMatch(/^4건/);
    expect(withTeams.teams?.industryShares?.items).toEqual([
      { item: "상하수도", quantity: "30대", share: "75.0%" },
      { item: "발전소", quantity: "10대", share: "25.0%" },
    ]);
    expect(withTeams.teams?.service).toMatchObject({
      trips: "18건",
      paidRatio: "68.8% (미입력 제외)",
      paidRevenue: "출장보고서에 금액이 없어 계산하지 않음",
      topRegion: "경상남도 창원시 4건 (전체의 22.2%)",
      topParts: ["Motor 5건", "Bearing 3건"],
    });
  });

  it("금액은 '7.09억원'·'6,668만원' 형식", () => {
    expect(input.revenue.total).toBe("6.00억원");
    expect(input.receivables).toMatchObject({
      baseMonth: "2026년 9월",
      asOf: "2026-09-30",
      total: "6,000만원",
      count: 2,
      longOverdue: { amount: "5,000만원", count: 1 },
      scheduled: { amount: "1,000만원", count: 1 },
      collectedThisMonth: { amount: "300만원", count: 1 },
      pastDue: { amount: "1,000만원", count: 1 },
    });
  });

  it("매출 구분(제품·상품·용역), 매입·경비 합계, 추정 손익", () => {
    expect(input.revenue.items.map((i) => i.item)).toEqual([
      "제품 매출",
      "상품 매출",
      "용역 매출",
    ]);
    expect(input.expense).toMatchObject({
      total: "4.20억원",
      purchaseTotal: "1.20억원", // 상품 6,000만 + 원재료 6,000만
      operatingTotal: "3.00억원", // 경비 3억 + 그 외 0
    });
    expect(input.profit.estimatedProfit).toBe("1.80억원");
  });

  it("장기 미수금 금액·건수 (거래처명 없이)", () => {
    expect(input.receivables.longOverdue).toEqual({
      amount: "5,000만원",
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

  it("목표 미달: 달성률·부족 %p·부족 금액·연간 진도·기대치 대비 부족액", () => {
    expect(input.target).toMatchObject({
      quarterTarget: "10.00억원",
      quarterTargetSource: "연간 목표에서 자동 배분",
      quarterActual: "6.00억원",
      quarterAchievement: "60.0%로 40.0%p 부족",
      quarterDifference: "4.00억원 부족",
      annualTarget: "40.00억원",
      cumulativeActualToQuarterEnd: "12.00억원",
      annualProgress: "연간 달성률 30.0%로 경과율 75.0% 대비 45.0%p 뒤처짐",
      // 기대치 = 40억 × 3/4 = 30억, 30억 − 12억 = 18억 부족
      expectedToQuarterEnd: "30.00억원",
      gapVsExpected: "18.00억원 부족",
    });
  });

  it("목표 초과: '초과'로 표시", () => {
    const over = buildAiInput(
      summaryFor({ allConfirmed: true, july: 500_000_000n }),
      q3,
    );
    expect(over.target).toMatchObject({
      quarterActual: "11.00억원",
      quarterAchievement: "110.0%로 10.0%p 초과",
      quarterDifference: "1.00억원 초과",
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
      hashAiInput(buildAiInput(summaryFor({ july: 310_000_000n }), q3)),
    ).not.toBe(base);
  });

  it("표시 단위(억원은 100만원)보다 작은 변경은 '최신 아님'으로 보지 않는다", () => {
    // AI 가 보는 숫자가 같으므로 분석 내용도 같다
    expect(
      hashAiInput(buildAiInput(summaryFor({ july: 300_010_000n }), q3)),
    ).toBe(hashAiInput(input));
  });

  it("사용자 메시지에 JSON 이 그대로 들어간다", () => {
    const message = buildUserMessage(input);
    expect(message).toContain("2026년 3분기");
    expect(message).toContain('"unconfirmedMonths"');
  });
});

describe("SYSTEM_PROMPT", () => {
  it("규칙 1~11번, 회사 설명, 60자 제한, 금액 표기, 3단 의미, 짝 맞추기", () => {
    expect(SYSTEM_PROMPT).toContain("전동밸브조작기 제조사(직원 12명)");
    for (let n = 1; n <= 11; n += 1) {
      expect(SYSTEM_PROMPT).toContain(`\n${n}. `);
    }
    expect(SYSTEM_PROMPT).toContain("한 문장은 60자 이내");
    expect(SYSTEM_PROMPT).toContain('"7.09억원", "6,668만원"');
    expect(SYSTEM_PROMPT).toContain("is_sample");
    expect(SYSTEM_PROMPT).toContain("summary(이번 기간 현황)");
    expect(SYSTEM_PROMPT).toContain("shortfalls(부족한 점·주의)");
    expect(SYSTEM_PROMPT).toContain("improvements(다음 분기 개선할 점)");
    expect(SYSTEM_PROMPT).toContain("같은 순서로 하나씩");
    expect(SYSTEM_PROMPT).toContain('"장기 미수금 거래처"');
  });
});

describe("mockAiComment (카드 3단이 모두 보이도록)", () => {
  const sentences = (r: ReturnType<typeof mockAiComment>) => [
    ...r.summary,
    ...r.shortfalls,
    ...r.improvements,
  ];

  it("[미확정 월] 3단 모두 채움, 9월 미확정 언급, 부족한 점과 개선 제안 짝", () => {
    const mock = mockAiComment(buildAiInput(summaryFor(), q3));
    expect(mock.summary).toEqual([
      "[모의] 매출 6.00억원(제품 6.00억원·상품 0원·용역 0원)입니다.",
      "[모의] 9월 미확정, 같은 달끼리 전 분기 대비 +50.0%입니다.",
      "[모의] 매입 1.20억원·경비 3.00억원, 추정 손익 1.80억원입니다.",
    ]);
    expect(mock.shortfalls).toEqual([
      "[모의] 기대치 대비 18.00억원 부족입니다.",
      "[모의] 장기 미수금 5,000만원(1건)입니다.",
    ]);
    expect(mock.improvements).toEqual([
      "[모의] 부족분만큼 수주·출하 일정을 앞당겨 점검합니다.",
      "[모의] 장기 미수금 거래처에 수금 일정을 확인합니다.",
      "[모의] 9월 실적을 확정해 분석을 갱신합니다.",
    ]);
    // 거래처명은 AI(모의 포함) 문장에 나오지 않는다
    expect(sentences(mock).join(" ")).not.toContain("비밀거래처");
  });

  it("[직전 분기 데이터 없음] 숫자 없이 '비교할 수 없습니다'", () => {
    const confirmed = mockAiComment(
      buildAiInput(summaryFor({ noPrevQuarter: true, allConfirmed: true }), q3),
    );
    expect(confirmed.summary[1]).toBe("[모의] 전 분기와는 비교할 수 없습니다.");
    const withDraft = mockAiComment(
      buildAiInput(summaryFor({ noPrevQuarter: true }), q3),
    );
    expect(withDraft.summary[1]).toBe(
      "[모의] 9월 미확정, 전 분기와는 비교할 수 없습니다.",
    );
  });

  it("[목표 초과 + 모두 확정] 부족한 점에 기대치 항목 없음, 미확정 언급 없음", () => {
    const mock = mockAiComment(
      buildAiInput(
        summaryFor({
          allConfirmed: true,
          withLastYear: true,
          july: 3_000_000_000n,
        }),
        q3,
      ),
    );
    expect(mock.shortfalls.join(" ")).not.toContain("기대치");
    expect(sentences(mock).join(" ")).not.toContain("미확정");
    expect(mock.improvements.length).toBe(mock.shortfalls.length + 1);
  });

  it("모의 응답도 문장 60자 이내, 저장 형식 통과", () => {
    for (const options of [
      {},
      { allConfirmed: true, withLastYear: true },
      { noPrevQuarter: true },
    ]) {
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
