// JSON 출력 요청 공통 함수: 구조화 출력(JSON 스키마) + 거절 대비 fallback + Zod 재검증 + 오류 분류
// 서버 전용 모듈에서만 호출한다 (클라이언트는 getAnthropicClient 를 통해 server-only)
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type {
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod";

import { AiError, type AiErrorKind } from "./errors";

/** beta.messages.create 와 같은 모양 — 테스트에서 가짜를 넣는다 */
export type CreateMessage = (
  params: MessageCreateParamsNonStreaming,
) => Promise<BetaMessage>;

export type GenerateJsonOptions<T extends z.ZodType> = {
  create: CreateMessage;
  model: string;
  system: string;
  user: string;
  schema: T;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
};

export type GenerateJsonResult<T> = {
  data: T;
  /** 실제로 응답한 모델 (거절 fallback 이 동작하면 요청 모델과 다를 수 있음) */
  model: string;
};

/** 거절(refusal) 시 서버가 다른 모델로 다시 시도하는 기능 (beta) */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export async function generateJson<T extends z.ZodType>(
  options: GenerateJsonOptions<T>,
): Promise<GenerateJsonResult<z.infer<T>>> {
  let response: BetaMessage;
  try {
    response = await options.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 16_000,
      system: options.system,
      messages: [{ role: "user", content: options.user }],
      output_config: {
        effort: options.effort ?? "medium",
        format: betaZodOutputFormat(options.schema),
      },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    });
  } catch (error) {
    throw toAiError(error);
  }

  if (response.stop_reason === "refusal") throw new AiError("refusal");
  if (response.stop_reason === "max_tokens") throw new AiError("truncated");

  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiError("invalid-output", "응답이 JSON 이 아님");
  }
  const parsed = options.schema.safeParse(json);
  if (!parsed.success) {
    throw new AiError(
      "invalid-output",
      parsed.error.issues[0]?.message ?? "스키마 불일치",
    );
  }
  return { data: parsed.data, model: response.model };
}

/** SDK 오류 → 오류 종류 (구체적인 것부터) */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  const kind: AiErrorKind =
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
      ? "auth"
      : error instanceof Anthropic.RateLimitError
        ? "rate-limit"
        : error instanceof Anthropic.BadRequestError ||
            error instanceof Anthropic.NotFoundError ||
            error instanceof Anthropic.UnprocessableEntityError
          ? "bad-request"
          : error instanceof Anthropic.InternalServerError
            ? "overloaded"
            : error instanceof Anthropic.APIConnectionTimeoutError
              ? "timeout"
              : error instanceof Anthropic.APIConnectionError
                ? "connection"
                : error instanceof Anthropic.APIError &&
                    (error.status ?? 0) >= 500
                  ? "overloaded"
                  : "unknown";
  return new AiError(
    kind,
    error instanceof Error ? error.message : String(error),
  );
}
