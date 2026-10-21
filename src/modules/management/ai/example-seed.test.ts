import { describe, expect, it } from "vitest";

import { computeManagementSummary } from "../metrics/summary";
import { date, financeMonth, receivable } from "../metrics/test-fixtures";
import {
  buildExampleRow,
  removeExamples,
  upsertExamples,
  type AiCommentStore,
  type ExampleRow,
} from "./example-seed";
import { EXAMPLE_MODEL, EXAMPLE_QUARTERS } from "./examples";
import type { QuarterPeriod } from "./rules";
import { aiCommentResultSchema, SENTENCE_PROMPT_MAX } from "./schemas";

const today = date("2026-10-20");
const q = (year: number, quarter: 1 | 2 | 3 | 4): QuarterPeriod => ({
  unit: "quarter",
  year,
  quarter,
});
const month = (year: number, m: number, sales: bigint, draft = false) =>
  financeMonth(year, m, {
    productSales: sales,
    goodsSales: sales / 5n,
    serviceSales: sales / 10n,
    goodsPurchase: sales / 10n,
    materialPurchase: sales / 5n,
    operatingExpense: sales / 4n,
    status: draft ? "DRAFT" : "CONFIRMED",
  });

/** 상황별 분기 지표: 2025년 목표 24억(분기 6억 자동 배분) */
function summaryFor(
  quarter: QuarterPeriod,
  monthsSales: Record<number, bigint>,
  options: { draftMonth?: number; over90?: boolean } = {},
) {
  const financeMonths = Object.entries(monthsSales).map(([m, s]) =>
    month(quarter.year, Number(m), s, Number(m) === options.draftMonth),
  );
  return computeManagementSummary({
    period: quarter,
    financeMonths,
    annualTarget: {
      year: quarter.year,
      revenueTarget: 2_400_000_000n,
      quarterTargets: [null, null, null, null],
    },
    receivables: options.over90
      ? [
          receivable("x1", {
            customerName: "장기미수(가상)",
            occurredOn: date(`${quarter.year}-01-05`),
            amount: 36_000_000n,
          }),
        ]
      : [],
    today,
  });
}

const sentences = (row: ExampleRow) => [
  ...row.result.summary,
  ...row.result.shortfalls,
  ...row.result.improvements,
];

describe("buildExampleRow", () => {
  // a) 목표 미달 + 90일 초과: 매출 = 월 값 × 1.3 (제품+상품 20%+용역 10%). 1분기 5.85억, 2분기 5.2억 → 누적 11.05억 < 기대치 12억, 장기 미수 1건
  const rowA = buildExampleRow(
    summaryFor(
      q(2025, 2),
      {
        1: 150_000_000n,
        2: 150_000_000n,
        3: 150_000_000n,
        4: 130_000_000n,
        5: 130_000_000n,
        6: 140_000_000n,
      },
      { over90: true },
    ),
    q(2025, 2),
  );
  // b) 목표 초과: 2분기 매출 11.7억 (목표 6억, 월 3억 × 1.3 × 3)
  const rowB = buildExampleRow(
    summaryFor(q(2025, 2), {
      1: 200_000_000n,
      2: 200_000_000n,
      3: 200_000_000n,
      4: 300_000_000n,
      5: 300_000_000n,
      6: 300_000_000n,
    }),
    q(2025, 2),
  );
  // d) 비교 불가: 직전 분기 데이터 없음 + 9월 미확정
  const rowD = buildExampleRow(
    summaryFor(
      q(2025, 3),
      { 7: 200_000_000n, 8: 200_000_000n, 9: 200_000_000n },
      { draftMonth: 9 },
    ),
    q(2025, 3),
  );

  it("저장 형식(Zod) 통과, 생성 방식 'example', 고정 id", () => {
    for (const row of [rowA, rowB, rowD]) {
      expect(aiCommentResultSchema.safeParse(row.result).success).toBe(true);
      expect(row.model).toBe(EXAMPLE_MODEL);
    }
    expect(rowA.id).toBe("ai-example-2025-q2");
  });

  it("모든 문장 60자 이내, 보고서체 평서문", () => {
    for (const row of [rowA, rowB, rowD]) {
      for (const s of sentences(row)) {
        expect([...s].length).toBeLessThanOrEqual(SENTENCE_PROMPT_MAX);
        expect(s).toMatch(/(니다|니다\(진도율 [\d.]+%\))\.?$|\)\.$/);
        expect(s).not.toMatch(/하세요/);
      }
    }
  });

  it("a) 목표 미달 + 90일 초과: 부족한 점과 개선 제안이 같은 순서로 짝", () => {
    expect(rowA.result.shortfalls[0]).toMatch(
      /^기간 경과 기대치보다 .+ 부족합니다\(진도율 [\d.]+%\)\.$/,
    );
    expect(rowA.result.improvements[0]).toMatch(
      /^분기 초 수주 잔고를 점검해 부족분 .+을 월별로 배정합니다\.$/,
    );
    const i90 = rowA.result.shortfalls.findIndex((s) =>
      s.startsWith("90일 초과"),
    );
    expect(rowA.result.shortfalls[i90]).toBe(
      "90일 초과 미수금이 3,600만원(1건)입니다.",
    );
    expect(rowA.result.improvements[i90]).toBe(
      "90일 초과 1건의 수금 일정을 거래처별로 확정합니다.",
    );
    // 거래처명은 문장에 없고, 서버가 따로 붙인다
    expect(sentences(rowA).join(" ")).not.toContain("장기미수(가상)");
    expect(rowA.result.longOverdue?.[0]?.name).toBe("장기미수(가상)");
    expect(JSON.stringify(rowA.inputSummary)).not.toContain("장기미수(가상)");
  });

  it("b) 목표 초과: 초과 달성 문장, 부족한 점 없음, 개선 제안 1개 이상", () => {
    expect(rowB.result.summary[2]).toBe(
      "분기 목표 6.00억원의 195.0%로 초과 달성했습니다.",
    );
    expect(rowB.result.shortfalls).toEqual([]);
    expect(rowB.result.improvements.length).toBeGreaterThanOrEqual(1);
    expect(rowB.result.headline).toBe(
      "연간 목표 24.00억원 중 19.50억원(81.3%)를 달성했습니다.",
    );
  });

  it("d) 비교 불가는 숫자 없이, 미확정 월 언급", () => {
    expect(rowD.result.summary[1]).toBe(
      "2025년 2분기 확정 데이터가 없어 비교할 수 없습니다.",
    );
    expect(rowD.result.improvements).toContain(
      "9월 실적을 확정한 뒤 분석을 갱신합니다.",
    );
  });
});

/** prisma.aiComment 와 같은 조건으로 동작하는 메모리 저장소 */
function memoryStore(
  initial: (Partial<ExampleRow> & {
    id: string;
    model: string;
    createdAt: Date;
  })[],
) {
  const rows = new Map(initial.map((r) => [r.id, { ...r }]));
  let clock = 0;
  const store: AiCommentStore = {
    async upsert({ where, create, update }) {
      const existing = rows.get(where.id);
      if (existing) rows.set(where.id, { ...existing, ...update });
      else
        rows.set(where.id, {
          ...create,
          createdAt: new Date(Date.UTC(2026, 9, 20, 0, 0, ++clock)),
        });
      return null;
    },
    async deleteMany({ where }) {
      let count = 0;
      for (const [id, row] of rows) {
        if (row.model === where.model && id.startsWith(where.id.startsWith)) {
          rows.delete(id);
          count += 1;
        }
      }
      return { count };
    },
  };
  return { store, rows };
}

describe("upsertExamples / removeExamples", () => {
  const exampleRows = EXAMPLE_QUARTERS.map(({ quarter }) =>
    buildExampleRow(
      summaryFor(quarter, { [quarter.quarter * 3]: 300_000_000n }),
      quarter,
    ),
  );
  const others = [
    { id: "user-ai-1", model: "claude-opus-5-5", createdAt: new Date() },
    { id: "user-mock-1", model: "mock", createdAt: new Date() },
    // 이름은 비슷하지만 예시가 아닌 기록 (model 이 다름) — 지우면 안 됨
    { id: "ai-example-manual", model: "mock", createdAt: new Date() },
  ];

  it("여러 번 실행해도 중복 없음, 다시 실행해도 생성 시각은 그대로", async () => {
    const { store, rows } = memoryStore(others);
    await upsertExamples(store, exampleRows);
    const firstCreated = [...rows.values()]
      .filter((r) => r.model === EXAMPLE_MODEL)
      .map((r) => r.createdAt);
    await upsertExamples(store, exampleRows);
    await upsertExamples(store, exampleRows);
    const examples = [...rows.values()].filter(
      (r) => r.model === EXAMPLE_MODEL,
    );
    expect(examples).toHaveLength(EXAMPLE_QUARTERS.length);
    expect(examples.map((r) => r.createdAt)).toEqual(firstCreated);
    expect(rows.size).toBe(EXAMPLE_QUARTERS.length + others.length);
  });

  it("--remove 는 예시만 지우고 다른 기록은 그대로", async () => {
    const { store, rows } = memoryStore(others);
    await upsertExamples(store, exampleRows);
    expect(await removeExamples(store)).toBe(EXAMPLE_QUARTERS.length);
    expect([...rows.keys()].sort()).toEqual(others.map((o) => o.id).sort());
    expect(await removeExamples(store)).toBe(0);
  });

  it("예시 분기는 서로 다르고, 시드 분기 중 2026년 3분기만 비워 둔다", () => {
    const keys = EXAMPLE_QUARTERS.map(
      ({ quarter }) => `${quarter.year}-Q${quarter.quarter}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(
      [
        "2024-Q4",
        "2025-Q1",
        "2025-Q2",
        "2025-Q3",
        "2025-Q4",
        "2026-Q1",
        "2026-Q2",
      ].sort(),
    );
  });
});
