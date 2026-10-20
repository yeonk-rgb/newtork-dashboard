import { describe, expect, it } from "vitest";

import {
  afterFailedLogin,
  isLocked,
  lockedMessage,
  newPasswordError,
  safeNextPath,
  sessionExpiry,
} from "./login-rules";

const at = (iso: string) => new Date(iso);
const NOW = at("2026-10-21T09:00:00Z");

describe("로그인 실패 5회 → 10분 잠금", () => {
  it("1~4회는 횟수만 올라간다", () => {
    let state = { failedLoginCount: 0, lockedUntil: null as Date | null };
    for (let i = 1; i <= 4; i++) {
      state = afterFailedLogin(state, NOW);
      expect(state).toEqual({ failedLoginCount: i, lockedUntil: null });
    }
  });

  it("5회째에 10분 잠금, 횟수는 0으로", () => {
    const state = afterFailedLogin(
      { failedLoginCount: 4, lockedUntil: null },
      NOW,
    );
    expect(state.failedLoginCount).toBe(0);
    expect(state.lockedUntil).toEqual(at("2026-10-21T09:10:00Z"));
    expect(isLocked(state.lockedUntil, at("2026-10-21T09:09:59Z"))).toBe(true);
    expect(isLocked(state.lockedUntil, at("2026-10-21T09:10:00Z"))).toBe(false);
  });

  it("잠금이 풀린 뒤 실패하면 처음부터 다시 센다", () => {
    const state = afterFailedLogin(
      { failedLoginCount: 3, lockedUntil: at("2026-10-21T08:59:00Z") },
      NOW,
    );
    expect(state).toEqual({ failedLoginCount: 1, lockedUntil: null });
  });

  it("남은 시간 안내 (분 올림)", () => {
    expect(lockedMessage(at("2026-10-21T09:10:00Z"), NOW)).toContain("10분 후");
    expect(lockedMessage(at("2026-10-21T09:00:30Z"), NOW)).toContain("1분 후");
  });
});

describe("세션 12시간", () => {
  it("로그인 시각 + 12시간", () => {
    expect(sessionExpiry(NOW)).toEqual(at("2026-10-21T21:00:00Z"));
  });
});

describe("safeNextPath — 로그인 후 돌아갈 주소", () => {
  it("이 사이트 경로만 허용", () => {
    expect(safeNextPath("/management?period=2026-Q3")).toBe(
      "/management?period=2026-Q3",
    );
    expect(safeNextPath("/production")).toBe("/production");
  });

  it("외부 주소·이상한 값은 버린다", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "/a\nb",
    ]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });

  it("로그인·비밀번호 변경 화면 자신은 제외", () => {
    expect(safeNextPath("/login")).toBeNull();
    expect(safeNextPath("/login?next=/x")).toBeNull();
    expect(safeNextPath("/account/password")).toBeNull();
  });
});

describe("새 비밀번호 규칙", () => {
  const check = (password: string, currentPassword = "Temp1234xyz") =>
    newPasswordError({ password, loginId: "prod_leader", currentPassword });

  it("8자 이상 + 영문·숫자 포함이면 통과", () => {
    expect(check("newpass12")).toBeNull();
    expect(check("A1b2c3d4")).toBeNull();
  });

  it("짧거나 한 종류만 있으면 거부", () => {
    expect(check("ab12")).toContain("8자");
    expect(check("abcdefgh")).toContain("영문과 숫자");
    expect(check("12345678")).toContain("영문과 숫자");
  });

  it("아이디·현재 비밀번호와 같으면 거부", () => {
    expect(
      newPasswordError({
        password: "Prod_Leader1",
        loginId: "prod_leader1",
        currentPassword: "x",
      }),
    ).toContain("아이디");
    expect(check("Temp1234xyz")).toContain("현재 비밀번호");
  });
});
