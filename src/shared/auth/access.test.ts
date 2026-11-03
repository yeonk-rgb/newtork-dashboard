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
      "/service/parts",
      "/admin",
    ]);
  });

  it("경영지원팀은 관리자 메뉴 제외 전부", () => {
    expect(hrefs("mgmt")).toEqual([
      "/",
      "/management",
      "/production",
      "/service",
      "/service/parts",
    ]);
  });

  it("팀장·팀원은 열람 범위의 팀만, 겸직은 둘 다", () => {
    expect(hrefs("prodMember")).toEqual(["/production"]);
    // 서비스는 친구 저장소처럼 "서비스"·"부품·가격" 두 묶음 (2026-11-03 통합 3단계)
    expect(hrefs("svcLeader")).toEqual(["/service", "/service/parts"]);
    expect(hrefs("dual")).toEqual([
      "/production",
      "/service",
      "/service/parts",
    ]);
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
        "미수금 건별 기록",
        "경영지원 관리",
        "엑셀 업로드·데이터 이관",
        "목표·항목 설정",
        "변경 이력",
      ]);
    }
  });

  it("생산 팀원은 경영지원 메뉴 자체가 없음", () => {
    expect(children("prodMember")).toBeUndefined();
  });
});

describe("서비스 하위 메뉴 (친구 저장소 config/menu.js 순서)", () => {
  it("서비스팀원도 열람 화면은 모두 보임 — 버튼만 비활성", () => {
    const pages = accessiblePages(FAKE_USERS.svcMember);
    expect(pages.map((p) => p.children?.map((c) => c.label))).toEqual([
      ["서비스 대시보드", "출장보고서"],
      [
        "부품 목록",
        "출장지 관리",
        "부품 가격 관리",
        "출장지별 가격 조회",
        "출장지 비교 분석",
      ],
    ]);
  });

  it("생산팀은 서비스 메뉴 없음", () => {
    expect(hrefs("prodMember")).not.toContain("/service/parts");
  });
});
