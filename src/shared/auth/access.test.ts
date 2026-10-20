import { describe, expect, it } from "vitest";

import { accessiblePages, homePathFor } from "./access";
import { FAKE_USERS, fakeUser } from "./testing/fake-users";

const hrefs = (key: keyof typeof FAKE_USERS) =>
  accessiblePages(FAKE_USERS[key]).map((page) => page.href);

describe("accessiblePages", () => {
  it("관리자는 관리자 메뉴까지 전부", () => {
    expect(hrefs("admin")).toEqual([
      "/",
      "/management",
      "/production",
      "/service",
      "/admin",
    ]);
  });

  it("경영지원팀은 관리자 메뉴 제외 전부", () => {
    expect(hrefs("mgmt")).toEqual([
      "/",
      "/management",
      "/production",
      "/service",
    ]);
  });

  it("팀장·팀원은 열람 범위의 팀만, 겸직은 둘 다", () => {
    expect(hrefs("prodMember")).toEqual(["/production"]);
    expect(hrefs("svcLeader")).toEqual(["/service"]);
    expect(hrefs("dual")).toEqual(["/production", "/service"]);
  });
});

describe("homePathFor", () => {
  it("메인을 볼 수 있으면 /", () => {
    expect(homePathFor(FAKE_USERS.mgmt)).toBe("/");
    expect(homePathFor(FAKE_USERS.admin)).toBe("/");
  });

  it("팀장·팀원은 자기 팀, 겸직은 생산 먼저", () => {
    expect(homePathFor(FAKE_USERS.prodMember)).toBe("/production");
    expect(homePathFor(FAKE_USERS.svcMember)).toBe("/service");
    expect(homePathFor(FAKE_USERS.dual)).toBe("/production");
  });

  it("열 수 있는 페이지가 없으면 권한 없음 안내 (메인으로 보내 무한 이동하지 않게)", () => {
    expect(homePathFor(fakeUser("prodMember", { viewTeams: [] }))).toBe(
      "/forbidden",
    );
    expect(homePathFor(fakeUser("admin", { active: false }))).toBe(
      "/forbidden",
    );
  });
});

describe("경영지원 하위 메뉴", () => {
  const children = (key: keyof typeof FAKE_USERS) =>
    accessiblePages(FAKE_USERS[key])
      .find((p) => p.href === "/management")
      ?.children?.map((c) => c.label);

  it("관리자·경영지원팀: 하위 메뉴 전부", () => {
    for (const key of ["admin", "mgmt"] as const) {
      expect(children(key)).toEqual([
        "경영지원 상세",
        "월간 입력",
        "미수금 관리",
        "엑셀 업로드·데이터 이관",
        "목표·항목 설정",
      ]);
    }
  });

  it("생산 팀원은 경영지원 메뉴 자체가 없음", () => {
    expect(children("prodMember")).toBeUndefined();
  });
});
