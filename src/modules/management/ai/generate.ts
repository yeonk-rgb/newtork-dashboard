// AI 분석 코멘트 생성 (서버 전용) — Server Action 은 app 계층(src/app/(dashboard)/ai-actions.ts)이 생산·서비스 숫자를 함께 넘겨 부른다
// (경영지원 모듈은 다른 팀 모듈을 import 하지 않으므로 팀 숫자를 직접 읽지 못한다)
import "server-only";

// AI 분석 생성 Server Action — confirm 권한, 끝난 분기, 동시 생성 확인을 모두 서버에서 다시 확인한다
import { refresh } from "next/cache";

import { AI_MODEL, aiMockMode, getAnthropicClient } from "@/shared/ai/client";
import {
  AiError,
  aiErrorMessage,
  isRetryable,
  type AiErrorKind,
} from "@/shared/ai/errors";
import { generateJson } from "@/shared/ai/generate-json";
import { can, getCurrentUser } from "@/shared/auth";
import type { TeamAiFacts } from "@/shared/contracts/team-ai";
import { prisma } from "@/shared/db/client";
import { periodLabel } from "@/shared/period/period";

import { getTodayKst, loadSummaryInput } from "../data/load-summary-input";
import { computeManagementSummary } from "../metrics/summary";
import { buildAnnotations } from "./annotations";
import { buildAiInput, type AiInput } from "./build-input";
import { hashAiInput } from "./hash";
import { hasUploadedInput, loadLatestAiComment } from "./load-comment";
import { MOCK_MODEL, mockAiComment } from "./mock-comment";
import { buildUserMessage, PROMPT_VERSION, SYSTEM_PROMPT } from "./prompt";
import { isAiRealDataBlocked, isUploadedDataBlocked } from "./real-data-policy";
import { aiAbilities, quarterKey, type QuarterPeriod } from "./rules";
import {
  aiCommentResponseSchema,
  generateAiCommentSchema,
  normalizeAiComment,
  type AiCommentResponse,
  type AiCommentResult,
} from "./schemas";

export type AiActionResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code: "FORBIDDEN" | "INVALID" | "CONFLICT" | "AI_ERROR";
      message: string;
      /** 다시 시도로 해결될 수 있는 오류 */
      retryable: boolean;
    };

const fail = (
  code: Exclude<AiActionResult, { ok: true }>["code"],
  message: string,
  retryable = false,
): AiActionResult => ({ ok: false, code, message, retryable });

/** 같은 분기를 동시에 두 번 생성하지 않도록 (API 비용 중복 방지, 서버 프로세스 단위) */
const inFlight = new Set<string>();

class ConflictError extends Error {}

async function requestAi(
  input: AiInput,
): Promise<{ response: AiCommentResponse; model: string }> {
  const mock = aiMockMode();
  if (mock === "success") {
    // 생성 중 표시를 확인할 수 있게 잠깐 기다린다
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return { response: mockAiComment(input), model: MOCK_MODEL };
  }
  if (mock === "fail") {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    throw new AiError("overloaded", "AI_MOCK=fail");
  }
  const client = getAnthropicClient();
  const { data, model } = await generateJson({
    create: (params) => client.beta.messages.create(params),
    model: AI_MODEL,
    system: SYSTEM_PROMPT,
    user: buildUserMessage(input),
    schema: aiCommentResponseSchema,
    effort: "medium",
  });
  return { response: data, model };
}

/** AI 응답(모의 포함) → 저장 형식. 80자 초과 문장은 잘라서 살리고, 요약이 없을 때만 실패 */
async function callAi(
  input: AiInput,
  key: string,
): Promise<{ result: AiCommentResult; model: string }> {
  const { response, model } = await requestAi(input);
  const normalized = normalizeAiComment(response);
  if (!normalized) {
    throw new AiError("invalid-output", "매출 현황 문장이 없음");
  }
  const { truncated, dropped } = normalized.report;
  if (truncated > 0 || dropped > 0) {
    console.warn(
      `[ai-comment] ${key} 응답 정리: ${truncated}문장 80자에서 자름, ${dropped}문장 3개 초과로 버림`,
    );
  }
  return { result: normalized.result, model };
}

export async function generateAiCommentWithTeams(
  raw: unknown,
  loadTeams: (period: QuarterPeriod) => Promise<TeamAiFacts>,
): Promise<AiActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user, "confirm", "management")) {
    return fail("FORBIDDEN", "AI 분석은 팀장만 실행할 수 있습니다.");
  }

  const parsed = generateAiCommentSchema.safeParse(raw);
  if (!parsed.success) return fail("INVALID", "요청 값을 확인하세요.");
  const { year, quarter, expectedLatestId, consent } = parsed.data;
  const period: QuarterPeriod = { unit: "quarter", year, quarter };

  const today = await getTodayKst();
  const summary = computeManagementSummary(
    await loadSummaryInput(period, today),
  );
  const abilities = aiAbilities(
    user,
    period,
    today,
    summary.confirmation.hasData,
    // 엑셀 업로드로 옮긴 달 — 외부 AI 전송 동의(AI_ALLOW_REAL_DATA=true, 05-19) 전 분석 불가
    isUploadedDataBlocked(await hasUploadedInput(period)),
    isAiRealDataBlocked(), // 배포 서버는 AI_ALLOW_REAL_DATA=true 일 때만
  );
  if (!abilities.canGenerate) {
    return fail(
      abilities.notice ? "INVALID" : "FORBIDDEN",
      abilities.notice ?? "AI 분석은 팀장만 실행할 수 있습니다.",
    );
  }
  // 관리자(대표)가 실제 숫자 차단을 넘어 실행 — 확인창 [확인] 없이는 보내지 않는다
  if (abilities.consentNotice) {
    if (consent !== true) {
      return fail(
        "INVALID",
        "외부 AI 전송 확인이 필요합니다. 다시 눌러 주세요.",
      );
    }
    console.info(
      `[ai-comment] ${quarterKey(year, quarter)} 관리자(대표) 확인으로 실제 숫자 분석`,
    );
  }

  const CONFLICT_MESSAGE =
    "다른 사용자가 방금 이 분기를 분석했습니다. 화면을 새로 불러왔습니다.";
  const latest = await loadLatestAiComment(year, quarter);
  if ((latest?.id ?? null) !== expectedLatestId) {
    refresh();
    return fail("CONFLICT", CONFLICT_MESSAGE);
  }

  const key = quarterKey(year, quarter);
  if (inFlight.has(key)) {
    return fail(
      "CONFLICT",
      "이 분기는 이미 분석 중입니다. 잠시 후 확인하세요.",
    );
  }
  inFlight.add(key);
  try {
    const input = buildAiInput(summary, period, await loadTeams(period));
    const inputHash = hashAiInput(input);
    const { result, model } = await callAi(input, key);
    // headline·장기 미수금 거래처명은 AI 가 아니라 서버가 만들어 함께 저장 (거래처명은 AI 로 보내지 않음)
    const annotations = buildAnnotations(summary);

    await prisma.$transaction(async (tx) => {
      // AI 응답을 기다리는 사이 다른 사람이 저장했으면 버린다
      const current = await tx.aiComment.findFirst({
        where: { year, quarter },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if ((current?.id ?? null) !== expectedLatestId) throw new ConflictError();
      await tx.aiComment.create({
        data: {
          year,
          quarter,
          inputSummary: input,
          result: { ...result, ...annotations },
          inputHash,
          model,
          promptVersion: PROMPT_VERSION,
          createdById: user.id,
        },
      });
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      refresh();
      return fail("CONFLICT", CONFLICT_MESSAGE);
    }
    if (error instanceof AiError) {
      // 원인 추적용 (키·입력 데이터는 남기지 않는다)
      console.error(`[ai-comment] ${key} 실패: ${error.kind}`, error.message);
      const kind: AiErrorKind = error.kind;
      return fail("AI_ERROR", aiErrorMessage(kind), isRetryable(kind));
    }
    throw error;
  } finally {
    inFlight.delete(key);
  }

  refresh();
  return {
    ok: true,
    message: `${periodLabel(period)} AI 분석을 저장했습니다.`,
  };
}
