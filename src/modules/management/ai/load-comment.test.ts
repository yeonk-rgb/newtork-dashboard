// 메인(/)·경영지원 상세(/management)가 같은 분기의 같은 기록을 보는지 — DB 는 가짜(findFirst 호출 확인)
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { Period } from "@/shared/period/period";

import { computeManagementSummary } from "../metrics/summary";
import { date, financeMonth } from "../metrics/test-fixtures";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth", () => ({
  loadUserNames: async () => (id: string) => id,
}));
const findFirst = vi.fn();
/** 업로드 데이터 개수 (엑셀 업로드로 저장된 달·목표) */
const uploadedMonths = vi.fn(async () => 0);
const uploadedTargets = vi.fn(async () => 0);
vi.mock("@/shared/db/client", () => ({
  prisma: {
    aiComment: { findFirst: (...args: unknown[]) => findFirst(...args) },
    monthlyFinance: {
      count: (...args: unknown[]) => uploadedMonths(...(args as [])),
    },
    annualTarget: {
      count: (...args: unknown[]) => uploadedTargets(...(args as [])),
    },
  },
}));

const { loadAiCommentView } = await import("./load-comment");
const { PROMPT_VERSION } = await import("./prompt");
const { aiTargetQuarter, UPLOADED_DATA_NOTICE } = await import("./rules");

const leader = FAKE_USERS.mgmt;
const today = date("2026-10-20");
const months = [7, 8].map((m) =>
  financeMonth(2026, m, { productSales: 100_000_000n }),
);

/** 화면이 하는 일과 같은 순서: 선택 기간 → 분석 분기 → 그 분기 지표 → 카드 데이터 */
async function cardFor(period: Period) {
  const selected = computeManagementSummary({
    period,
    financeMonths: months,
    annualTarget: null,
    receivables: [],
    today,
  });
  const quarter = aiTargetQuarter(
    period,
    selected.confirmation.confirmedMonths,
  )!;
  const quarterSummary = computeManagementSummary({
    period: quarter,
    financeMonths: months,
    annualTarget: null,
    receivables: [],
    today,
  });
  return loadAiCommentView(leader, quarter, quarterSummary, today);
}

describe("두 화면이 같은 분기 기록을 공유", () => {
  beforeEach(() => {
    findFirst.mockReset();
    findFirst.mockResolvedValue({
      id: "shared-q3",
      year: 2026,
      quarter: 3,
      result: { summary: ["요약"], shortfalls: [], improvements: ["제안"] },
      inputHash: "x",
      model: "mock",
      promptVersion: PROMPT_VERSION,
      createdById: "dev-mgmt-leader",
      createdAt: new Date("2026-10-20T01:00:00Z"),
    });
  });

  it("메인(8월 보기)·상세(3분기 보기)·연간 보기 모두 (2026, 3분기) 하나로만 조회", async () => {
    const views = await Promise.all([
      cardFor({ unit: "month", year: 2026, month: 8 }), // 메인에서 8월 선택
      cardFor({ unit: "quarter", year: 2026, quarter: 3 }), // /management 기본
      cardFor({ unit: "year", year: 2026 }), // 연간 보기
    ]);
    for (const view of views) {
      expect(view.latestId).toBe("shared-q3");
      expect(view.quarterLabel).toBe("2026년 3분기");
    }
    // 조회 조건에 화면 구분이 없다 → 어느 화면에서 저장해도 같은 기록
    for (const [args] of findFirst.mock.calls) {
      expect(args).toEqual({
        where: { year: 2026, quarter: 3 },
        orderBy: { createdAt: "desc" },
      });
    }
  });
});

describe("업로드 데이터가 AI 입력에 들어가면 분석 차단 (05-19 동의 전)", () => {
  beforeEach(() => {
    findFirst.mockReset();
    findFirst.mockResolvedValue(null);
    uploadedMonths.mockReset();
    uploadedTargets.mockReset();
    uploadedMonths.mockResolvedValue(0);
    uploadedTargets.mockResolvedValue(0);
  });

  it("업로드 데이터가 없으면 [분석하기] 가능 (샘플·예시 데이터는 지금처럼)", async () => {
    const view = await cardFor({ unit: "quarter", year: 2026, quarter: 3 });
    expect(view.abilities).toEqual({ canGenerate: true, notice: null });
  });

  it("AI 입력 달 중 업로드된 달이 있으면 막고 안내", async () => {
    uploadedMonths.mockResolvedValue(2);
    const view = await cardFor({ unit: "quarter", year: 2026, quarter: 3 });
    expect(view.abilities).toEqual({
      canGenerate: false,
      notice: UPLOADED_DATA_NOTICE,
    });
  });

  it("그 해 연간 목표가 업로드된 경우도 막는다", async () => {
    uploadedTargets.mockResolvedValue(1);
    const view = await cardFor({ unit: "quarter", year: 2026, quarter: 3 });
    expect(view.abilities.canGenerate).toBe(false);
  });

  it("조회 범위: 그 분기·직전 분기·전년 동기·1월~분기 말", async () => {
    await cardFor({ unit: "quarter", year: 2026, quarter: 3 });
    const where = (
      uploadedMonths.mock.calls[0] as unknown as [
        { where: { OR: { year: number; month: number }[] } },
      ]
    )[0].where;
    const keys = where.OR.map((m) => `${m.year}-${m.month}`).sort();
    expect(keys).toEqual(
      [
        "2026-1",
        "2026-2",
        "2026-3",
        "2026-4",
        "2026-5",
        "2026-6",
        "2026-7",
        "2026-8",
        "2026-9",
        "2025-7",
        "2025-8",
        "2025-9",
      ].sort(),
    );
  });
});
