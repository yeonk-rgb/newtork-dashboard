import { describe, expect, it } from "vitest";

import { routeAccess } from "./route-access";
import { FAKE_USERS, fakeUser, type FakeUserKey } from "./testing/fake-users";

const PATHS = [
  "/",
  "/management",
  "/management/entry",
  "/api/management/upload-template",
  "/production",
  "/service",
  "/admin",
] as const;

const short = (r: ReturnType<typeof routeAccess>) =>
  r.type === "redirect" ? `→${r.to}` : r.type === "allow" ? "○" : "403";

// 경로별 결과: ○ 허용 / →이동 / 403
const EXPECTED: Record<FakeUserKey, string[]> = {
  admin: ["○", "○", "○", "○", "○", "○", "○"],
  mgmt: ["○", "○", "○", "○", "○", "○", "403"],
  prodLeader: ["→/production", "403", "403", "403", "○", "403", "403"],
  prodMember: ["→/production", "403", "403", "403", "○", "403", "403"],
  svcLeader: ["→/service", "403", "403", "403", "403", "○", "403"],
  svcMember: ["→/service", "403", "403", "403", "403", "○", "403"],
  dual: ["→/production", "403", "403", "403", "○", "○", "403"],
};

describe("routeAccess — 사용자별 경로 결과", () => {
  it.each(Object.keys(EXPECTED) as FakeUserKey[])("%s", (key) => {
    expect(PATHS.map((p) => short(routeAccess(FAKE_USERS[key], p)))).toEqual(
      EXPECTED[key],
    );
  });

  it("하위 경로도 같은 팀 규칙 (접두사만 같은 다른 경로는 제외)", () => {
    expect(short(routeAccess(FAKE_USERS.svcMember, "/production/report"))).toBe(
      "403",
    );
    expect(short(routeAccess(FAKE_USERS.svcMember, "/productionx"))).toBe("○");
    expect(short(routeAccess(FAKE_USERS.prodMember, "/admin/users"))).toBe(
      "403",
    );
  });

  it("공통 화면은 누구나 (권한 없음 안내·비밀번호 변경)", () => {
    for (const path of ["/forbidden", "/account/password"]) {
      expect(short(routeAccess(FAKE_USERS.prodMember, path))).toBe("○");
    }
  });

  it("볼 수 있는 페이지가 없으면 메인도 403 (무한 이동 방지)", () => {
    const empty = fakeUser("prodMember", { viewTeams: [] });
    expect(short(routeAccess(empty, "/"))).toBe("403");
  });
});
