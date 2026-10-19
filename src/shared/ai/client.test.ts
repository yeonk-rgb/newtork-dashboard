import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { aiMockMode, getAnthropicClient } = await import("./client");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAnthropicClient", () => {
  it("테스트에서는 키가 있어도 실제 클라이언트를 만들지 않는다 (CI 실제 호출 방지)", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(() => getAnthropicClient()).toThrow(/테스트에서는/);
  });
});

describe("aiMockMode", () => {
  it("개발 서버에서만 AI_MOCK 을 따른다", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_MOCK", "true");
    expect(aiMockMode()).toBe("success");
    vi.stubEnv("AI_MOCK", "fail");
    expect(aiMockMode()).toBe("fail");
    vi.stubEnv("AI_MOCK", "");
    expect(aiMockMode()).toBe("off");
  });

  it("배포 빌드(production)·테스트에서는 무시", () => {
    vi.stubEnv("AI_MOCK", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(aiMockMode()).toBe("off");
    vi.stubEnv("NODE_ENV", "test");
    expect(aiMockMode()).toBe("off");
  });
});
