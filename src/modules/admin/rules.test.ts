import { describe, expect, it } from "vitest";

import {
  keepsAnAdmin,
  normalizeScope,
  rowAbilities,
  sameScope,
  scopeError,
} from "./rules";

describe("normalizeScope — 역할에 맞게 범위 정리", () => {
  it("관리자·경영지원팀은 체크박스 없이 '전체' (빈 배열)", () => {
    for (const role of ["ADMIN", "MANAGEMENT"] as const) {
      expect(
        normalizeScope({
          role,
          viewTeams: ["production"],
          editTeams: ["service"],
        }),
      ).toEqual({ role, viewTeams: [], editTeams: [] });
    }
  });

  it("팀원은 수정 권한 없음", () => {
    expect(
      normalizeScope({
        role: "MEMBER",
        viewTeams: ["service"],
        editTeams: ["service"],
      }),
    ).toEqual({ role: "MEMBER", viewTeams: ["service"], editTeams: [] });
  });

  it("팀장은 열람 범위에서 체크한 팀만 수정, 순서는 생산 → 서비스", () => {
    expect(
      normalizeScope({
        role: "LEADER",
        viewTeams: ["service", "production"],
        editTeams: ["service"],
      }),
    ).toEqual({
      role: "LEADER",
      viewTeams: ["production", "service"],
      editTeams: ["service"],
    });
    expect(
      normalizeScope({
        role: "LEADER",
        viewTeams: ["production"],
        editTeams: ["service"],
      }).editTeams,
    ).toEqual([]);
  });
});

describe("scopeError", () => {
  it("팀장·팀원은 열람 범위 최소 1개", () => {
    expect(
      scopeError({ role: "MEMBER", viewTeams: [], editTeams: [] }),
    ).toContain("1개 이상");
    expect(
      scopeError({ role: "LEADER", viewTeams: [], editTeams: [] }),
    ).toContain("1개 이상");
    expect(
      scopeError({ role: "ADMIN", viewTeams: [], editTeams: [] }),
    ).toBeNull();
  });

  it("정리되지 않은 범위는 거부", () => {
    expect(
      scopeError({
        role: "MEMBER",
        viewTeams: ["production"],
        editTeams: ["production"],
      }),
    ).not.toBeNull();
    expect(
      scopeError({
        role: "LEADER",
        viewTeams: ["production"],
        editTeams: ["service"],
      }),
    ).not.toBeNull();
    expect(
      scopeError({
        role: "LEADER",
        viewTeams: ["production"],
        editTeams: ["production"],
      }),
    ).toBeNull();
  });
});

describe("sameScope — 바뀐 줄 판단", () => {
  it("순서·역할상 의미 없는 값 차이는 같은 것으로", () => {
    expect(
      sameScope(
        { role: "MEMBER", viewTeams: ["service", "production"], editTeams: [] },
        { role: "MEMBER", viewTeams: ["production", "service"], editTeams: [] },
      ),
    ).toBe(true);
    expect(
      sameScope(
        { role: "ADMIN", viewTeams: ["production"], editTeams: [] },
        { role: "ADMIN", viewTeams: [], editTeams: [] },
      ),
    ).toBe(true);
    expect(
      sameScope(
        { role: "LEADER", viewTeams: ["production"], editTeams: [] },
        {
          role: "LEADER",
          viewTeams: ["production"],
          editTeams: ["production"],
        },
      ),
    ).toBe(false);
  });
});

describe("keepsAnAdmin — 관리자 최소 1명", () => {
  const rows = [
    { id: "a", role: "ADMIN" as const, active: true },
    { id: "b", role: "ADMIN" as const, active: false },
    { id: "c", role: "MEMBER" as const, active: true },
  ];

  it("활성 관리자가 남으면 통과", () => {
    expect(keepsAnAdmin(rows, {})).toBe(true);
    expect(keepsAnAdmin(rows, { roles: new Map([["c", "ADMIN"]]) })).toBe(true);
  });

  it("마지막 활성 관리자의 역할 변경·비활성화는 거부 (비활성 관리자는 세지 않음)", () => {
    expect(keepsAnAdmin(rows, { roles: new Map([["a", "MANAGEMENT"]]) })).toBe(
      false,
    );
    expect(keepsAnAdmin(rows, { deactivate: "a" })).toBe(false);
  });
});

describe("rowAbilities", () => {
  it("본인 줄: 아무것도 못 바꿈 (버튼 대신 '본인')", () => {
    expect(
      rowAbilities({ id: "a" }, { id: "a", role: "ADMIN", active: true }),
    ).toEqual({
      isSelf: true,
      editRole: false,
      editScope: false,
      resetPassword: false,
      deactivate: false,
      restore: false,
    });
  });

  it("다른 직원: 활성이면 변경·초기화·비활성화, 비활성이면 복구만", () => {
    expect(
      rowAbilities({ id: "a" }, { id: "b", role: "MEMBER", active: true }),
    ).toMatchObject({
      editRole: true,
      resetPassword: true,
      deactivate: true,
      restore: false,
    });
    expect(
      rowAbilities({ id: "a" }, { id: "b", role: "MEMBER", active: false }),
    ).toMatchObject({
      editRole: false,
      resetPassword: false,
      deactivate: false,
      restore: true,
    });
  });
});
