import { afterEach, describe, expect, it, vi } from "vitest";

import { isAiRealDataBlocked } from "./real-data-policy";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAiRealDataBlocked", () => {
  it("배포 빌드(production)는 AI_ALLOW_REAL_DATA=true 일 때만 허용", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_ALLOW_REAL_DATA", "");
    expect(isAiRealDataBlocked()).toBe(true);
    vi.stubEnv("AI_ALLOW_REAL_DATA", "false");
    expect(isAiRealDataBlocked()).toBe(true);
    vi.stubEnv("AI_ALLOW_REAL_DATA", "true");
    expect(isAiRealDataBlocked()).toBe(false);
  });

  it("개발·테스트(로컬 샘플 DB)는 막지 않음", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_ALLOW_REAL_DATA", "false");
    expect(isAiRealDataBlocked()).toBe(false);
  });
});
