import { describe, expect, it } from "vitest";

import { accessiblePages, homePathFor } from "./access";
import { findDevUser } from "./dev-users";

const user = (id: string) => findDevUser(id)!;
const hrefs = (id: string) =>
  accessiblePages(user(id)).map((page) => page.href);

describe("accessiblePages", () => {
  it("관리자는 관리자 메뉴까지 전부", () => {
    expect(hrefs("dev-admin")).toEqual([
      "/",
      "/management",
      "/production",
      "/service",
      "/admin",
    ]);
  });

  it("대표·경영지원은 관리자 메뉴 제외 전부", () => {
    for (const id of ["dev-ceo", "dev-mgmt-leader", "dev-mgmt-member"]) {
      expect(hrefs(id)).toEqual([
        "/",
        "/management",
        "/production",
        "/service",
      ]);
    }
  });

  it("생산 팀원은 생산만", () => {
    expect(hrefs("dev-prod-member")).toEqual(["/production"]);
  });
});

describe("homePathFor", () => {
  it("메인을 볼 수 있으면 /", () => {
    expect(homePathFor(user("dev-mgmt-member"))).toBe("/");
  });

  it("생산 팀원은 /production", () => {
    expect(homePathFor(user("dev-prod-member"))).toBe("/production");
  });
});
