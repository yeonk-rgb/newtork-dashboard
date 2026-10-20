// 예시 AI 분석 넣기·지우기 (npm run seed:ai-examples) — DB 는 prisma 와 같은 모양의 객체로 받아 테스트에서 가짜를 쓴다
// - 넣기: 고정 id(ai-example-2026-q2 등)로 upsert → 여러 번 실행해도 중복 없음
//   다시 실행할 때는 내용만 갱신하고 생성 시각은 그대로 둔다 (그 사이 [다시 분석]한 새 기록이 계속 최신으로 남게)
// - 지우기: model = "example" 이면서 id 가 ai-example- 로 시작하는 것만 (다른 기록은 건드리지 않음)
import type { ManagementSummary } from "../metrics/types";
import { buildAnnotations } from "./annotations";
import { buildAiInput } from "./build-input";
import {
  buildExampleComment,
  EXAMPLE_ID_PREFIX,
  EXAMPLE_MODEL,
  exampleId,
} from "./examples";
import { hashAiInput } from "./hash";
import { PROMPT_VERSION } from "./prompt";
import type { QuarterPeriod } from "./rules";
import {
  aiCommentResultSchema,
  normalizeAiComment,
  type AiCommentResult,
} from "./schemas";

export const EXAMPLE_CREATED_BY = "seed";

export type ExampleRow = {
  id: string;
  year: number;
  quarter: number;
  inputSummary: ReturnType<typeof buildAiInput>;
  result: AiCommentResult;
  inputHash: string;
  model: string;
  promptVersion: string;
  createdById: string;
};

/** 분기 지표 → 저장할 예시 기록. 응답 형식(Zod)·문장 길이를 통과하지 못하면 에러 */
export function buildExampleRow(
  summary: ManagementSummary,
  quarter: QuarterPeriod,
): ExampleRow {
  const input = buildAiInput(summary, quarter);
  const normalized = normalizeAiComment(buildExampleComment(summary, quarter));
  if (!normalized)
    throw new Error(`${summary.label} 예시: 매출 현황 문장 없음`);
  const { truncated, dropped } = normalized.report;
  if (truncated > 0 || dropped > 0) {
    throw new Error(
      `${summary.label} 예시가 형식을 넘음 (80자 초과 ${truncated}, 3개 초과 ${dropped})`,
    );
  }
  const result = aiCommentResultSchema.parse({
    ...normalized.result,
    ...buildAnnotations(summary),
  });
  return {
    id: exampleId(quarter.year, quarter.quarter),
    year: quarter.year,
    quarter: quarter.quarter,
    inputSummary: input,
    result,
    inputHash: hashAiInput(input),
    model: EXAMPLE_MODEL,
    promptVersion: PROMPT_VERSION,
    createdById: EXAMPLE_CREATED_BY,
  };
}

/** prisma.aiComment 중 쓰는 부분 */
export type AiCommentStore = {
  upsert(args: {
    where: { id: string };
    create: ExampleRow;
    update: Omit<ExampleRow, "id" | "createdById">;
  }): Promise<unknown>;
  deleteMany(args: {
    where: { model: string; id: { startsWith: string } };
  }): Promise<{ count: number }>;
};

export async function upsertExamples(
  store: AiCommentStore,
  rows: ExampleRow[],
): Promise<void> {
  for (const row of rows) {
    const { id, createdById, ...update } = row;
    void createdById;
    await store.upsert({ where: { id }, create: row, update });
  }
}

export async function removeExamples(store: AiCommentStore): Promise<number> {
  const { count } = await store.deleteMany({
    where: { model: EXAMPLE_MODEL, id: { startsWith: EXAMPLE_ID_PREFIX } },
  });
  return count;
}
