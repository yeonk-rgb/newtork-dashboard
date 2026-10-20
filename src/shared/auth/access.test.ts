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

describe("경영지원 하위 메뉴", () => {
  const children = (id: string) =>
    accessiblePages(user(id))
      .find((p) => p.href === "/management")
      ?.children?.map((c) => c.label);

  it("팀장·관리자·대표: 경영지원 상세 + 월간 입력 + 미수금 관리 + 엑셀 업로드 + 목표·항목 설정", () => {
    for (const id of ["dev-mgmt-leader", "dev-admin", "dev-ceo"]) {
      expect(children(id)).toEqual([
        "경영지원 상세",
        "월간 입력",
        "미수금 관리",
        "엑셀 업로드·데이터 이관",
        "목표·항목 설정",
      ]);
    }
  });

  it("팀원: 엑셀 업로드 화면은 보이고(저장 불가), 목표·항목 설정은 보이지 않음", () => {
    expect(children("dev-mgmt-member")).toEqual([
      "경영지원 상세",
      "월간 입력",
      "미수금 관리",
      "엑셀 업로드·데이터 이관",
    ]);
  });

  it("생산 팀원은 경영지원 메뉴 자체가 없음", () => {
    expect(children("dev-prod-member")).toBeUndefined();
  });
});
