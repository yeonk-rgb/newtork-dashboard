import { describe, expect, it } from "vitest";

import {
  isDemoMode,
  isDevSwitchEnabled,
  resolveCurrentUser,
} from "./resolve-user";

const dev = { nodeEnv: "development", demoMode: undefined };
const prod = { nodeEnv: "production", demoMode: undefined };
const prodDemo = { nodeEnv: "production", demoMode: "true" };

describe("resolveCurrentUser", () => {
  it("개발: 쿠키의 사용자로 전환된다", () => {
    expect(resolveCurrentUser(dev, "dev-prod-member")?.id).toBe(
      "dev-prod-member",
    );
    expect(resolveCurrentUser(dev, "dev-admin")?.id).toBe("dev-admin");
  });

  it("개발: 쿠키가 없거나 모르는 id면 경영지원 팀장", () => {
    expect(resolveCurrentUser(dev, undefined)?.id).toBe("dev-mgmt-leader");
    expect(resolveCurrentUser(dev, "hacker")?.id).toBe("dev-mgmt-leader");
  });

  it("배포 기본: 접근 차단(null) — 쿠키가 있어도 무시", () => {
    expect(resolveCurrentUser(prod, undefined)).toBeNull();
    expect(resolveCurrentUser(prod, "dev-admin")).toBeNull();
  });

  it("배포 + DEMO_MODE=true: 경영지원 팀장 고정, 쿠키로 전환 불가", () => {
    expect(resolveCurrentUser(prodDemo, undefined)?.id).toBe("dev-mgmt-leader");
    expect(resolveCurrentUser(prodDemo, "dev-admin")?.id).toBe(
      "dev-mgmt-leader",
    );
  });

  it("DEMO_MODE는 정확히 'true'일 때만", () => {
    expect(
      resolveCurrentUser({ nodeEnv: "production", demoMode: "1" }, undefined),
    ).toBeNull();
    expect(
      resolveCurrentUser(
        { nodeEnv: "production", demoMode: "TRUE" },
        undefined,
      ),
    ).toBeNull();
  });

  it("테스트 등 그 외 환경은 차단", () => {
    expect(
      resolveCurrentUser({ nodeEnv: "test", demoMode: "true" }, "dev-admin"),
    ).toBeNull();
  });
});

describe("환경 판별", () => {
  it("사용자 전환은 개발에서만", () => {
    expect(isDevSwitchEnabled(dev)).toBe(true);
    expect(isDevSwitchEnabled(prod)).toBe(false);
    expect(isDevSwitchEnabled(prodDemo)).toBe(false);
  });

  it("데모 모드는 배포 + DEMO_MODE=true 에서만", () => {
    expect(isDemoMode(prodDemo)).toBe(true);
    expect(isDemoMode({ nodeEnv: "development", demoMode: "true" })).toBe(
      false,
    );
  });
});
