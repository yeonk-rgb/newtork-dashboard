// Anthropic 클라이언트 (서버 전용). 키는 .env 의 ANTHROPIC_API_KEY — 클라이언트로 절대 보내지 않는다
import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { AiError } from "./errors";

/** 기본 모델 — 공식 문서의 현재 권장 모델 (2026-10 기준) */
export const AI_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;

/**
 * 실제 API 클라이언트. 테스트(Vitest)에서는 만들 수 없게 막아
 * 테스트·CI 가 실수로 실제 API 를 호출하지 않도록 한다 (테스트는 가짜 create 를 주입)
 */
export function getAnthropicClient(): Anthropic {
  if (process.env.VITEST) {
    throw new Error(
      "테스트에서는 실제 Anthropic 클라이언트를 만들 수 없습니다. 가짜 create 를 주입하세요.",
    );
  }
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new AiError("not-configured");
  client ??= new Anthropic({
    apiKey,
    // 분석 1회는 보통 수십 초 — 너무 오래 기다리지 않게 90초, 재시도 1회
    timeout: 90_000,
    maxRetries: 1,
  });
  return client;
}

/**
 * 개발용 모의 응답 모드 (AI_MOCK=true, 실패 연습은 AI_MOCK=fail).
 * 개발 서버(next dev)에서만 동작하고 배포 빌드·테스트에서는 무시한다.
 */
export function aiMockMode(): "off" | "success" | "fail" {
  if (process.env.NODE_ENV !== "development") return "off";
  const value = process.env.AI_MOCK?.trim().toLowerCase();
  if (value === "true") return "success";
  if (value === "fail") return "fail";
  return "off";
}
