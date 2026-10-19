// 실제 API 를 호출하지 않는다 — 가짜 create 를 주입해 요청 모양·응답 처리·오류 분류만 확인
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AiError } from "./errors";
import { generateJson, toAiError, type CreateMessage } from "./generate-json";

const schema = z.object({
  summary: z.string(),
  items: z.array(z.string()).max(2),
});

function message(
  text: string,
  overrides: Partial<BetaMessage> = {},
): BetaMessage {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
    ...overrides,
  } as BetaMessage;
}

const run = (create: CreateMessage) =>
  generateJson({
    create,
    model: "claude-opus-5-5",
    system: "시스템",
    user: "사용자",
    schema,
  });

async function kindOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error instanceof AiError ? error.kind : `not AiError: ${error}`;
  }
  return "no error";
}

describe("generateJson", () => {
  it("요청: 모델·JSON 출력 형식·effort·거절 대비 fallback", async () => {
    const create = vi.fn<CreateMessage>(async () =>
      message('{"summary":"좋음","items":[]}'),
    );
    const result = await run(create);
    expect(result).toEqual({
      data: { summary: "좋음", items: [] },
      model: "claude-opus-5-5",
    });

    const params = create.mock.calls[0][0] as MessageCreateParamsNonStreaming;
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.system).toBe("시스템");
    expect(params.messages).toEqual([{ role: "user", content: "사용자" }]);
    expect(params.output_config?.effort).toBe("medium");
    expect(params.output_config?.format?.type).toBe("json_schema");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    // 이 모델은 thinking 비활성화·budget_tokens 를 받지 않는다 → 보내지 않음
    expect(params.thinking).toBeUndefined();
  });

  it("fallback 으로 다른 모델이 응답하면 그 모델을 돌려준다", async () => {
    const result = await run(async () =>
      message('{"summary":"x","items":[]}', { model: "claude-opus-4-8" }),
    );
    expect(result.model).toBe("claude-opus-4-8");
  });

  it("거절·잘림은 내용보다 먼저 확인", async () => {
    expect(
      await kindOf(run(async () => message("", { stop_reason: "refusal" }))),
    ).toBe("refusal");
    expect(
      await kindOf(
        run(async () =>
          message('{"summary":"잘', { stop_reason: "max_tokens" }),
        ),
      ),
    ).toBe("truncated");
  });

  it("JSON 이 아니거나 형식이 다르면 invalid-output", async () => {
    expect(await kindOf(run(async () => message("요약입니다")))).toBe(
      "invalid-output",
    );
    expect(
      await kindOf(
        run(async () => message('{"summary":"x","items":["a","b","c"]}')),
      ),
    ).toBe("invalid-output");
  });

  it("SDK 오류를 종류별로 나눈다", async () => {
    const headers = new Headers();
    const cases: [unknown, string][] = [
      [new Anthropic.AuthenticationError(401, undefined, "x", headers), "auth"],
      [
        new Anthropic.PermissionDeniedError(403, undefined, "x", headers),
        "auth",
      ],
      [
        new Anthropic.RateLimitError(429, undefined, "x", headers),
        "rate-limit",
      ],
      [
        new Anthropic.BadRequestError(400, undefined, "x", headers),
        "bad-request",
      ],
      [
        new Anthropic.InternalServerError(529, undefined, "x", headers),
        "overloaded",
      ],
      [new Anthropic.APIConnectionTimeoutError(), "timeout"],
      [new Anthropic.APIConnectionError({ message: "x" }), "connection"],
      [new Error("뭔가"), "unknown"],
    ];
    for (const [error, kind] of cases) {
      expect(toAiError(error).kind).toBe(kind);
      expect(
        await kindOf(
          run(async () => {
            throw error;
          }),
        ),
      ).toBe(kind);
    }
  });
});
