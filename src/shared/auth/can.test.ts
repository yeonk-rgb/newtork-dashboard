import { describe, expect, it } from "vitest";

import { can, canManageUsers } from "./can";
import { FAKE_USERS, fakeUser, type FakeUserKey } from "./testing/fake-users";
import type { Action, AppUser, Team } from "./types";

const ACTIONS: Action[] = ["view", "edit", "confirm"];
const TEAMS: Team[] = ["management", "production", "service"];

// 기대값: 동작별로 허용되는 팀 (M = 경영지원·메인, P = 생산, S = 서비스)
type Expect = Record<Action, string>;

/** 역할 4개 × 팀 3개 × 동작 3개 = 36 (팀장·팀원은 생산 소속 기준) */
const ROLE_MATRIX: [string, AppUser, Expect][] = [
  ["관리자", FAKE_USERS.admin, { view: "MPS", edit: "MPS", confirm: "MPS" }],
  ["경영지원팀", FAKE_USERS.mgmt, { view: "MPS", edit: "MPS", confirm: "MPS" }],
  ["팀장(생산)", FAKE_USERS.prodLeader, { view: "P", edit: "P", confirm: "P" }],
  ["팀원(생산)", FAKE_USERS.prodMember, { view: "P", edit: "", confirm: "" }],
];

/** 시드 계정 7명 전체 */
const SEED_EXPECTED: Record<FakeUserKey, Expect> = {
  admin: { view: "MPS", edit: "MPS", confirm: "MPS" },
  mgmt: { view: "MPS", edit: "MPS", confirm: "MPS" },
  prodLeader: { view: "P", edit: "P", confirm: "P" },
  prodMember: { view: "P", edit: "", confirm: "" },
  svcLeader: { view: "S", edit: "S", confirm: "S" },
  svcMember: { view: "S", edit: "", confirm: "" },
  dual: { view: "PS", edit: "", confirm: "" },
};

const LETTER: Record<Team, string> = {
  management: "M",
  production: "P",
  service: "S",
};

const expand = (label: string, user: AppUser, expect: Expect) =>
  ACTIONS.flatMap((action) =>
    TEAMS.map((team) => ({
      label,
      user,
      action,
      team,
      expected: expect[action].includes(LETTER[team]),
    })),
  );

const allowedTeams = (user: AppUser, action: Action) =>
  TEAMS.filter((team) => can(user, action, team))
    .map((team) => LETTER[team])
    .join("");

describe("can(user, action, team) — 역할 4개 × 팀 3개 × 동작 3개", () => {
  const cases = ROLE_MATRIX.flatMap(([label, user, e]) =>
    expand(label, user, e),
  );

  it("36개 케이스", () => {
    expect(cases).toHaveLength(36);
  });

  it.each(cases)("$label · $action · $team → $expected", (c) => {
    expect(can(c.user, c.action, c.team)).toBe(c.expected);
  });
});

describe("시드 계정 7명", () => {
  it.each(Object.keys(SEED_EXPECTED) as FakeUserKey[])("%s", (key) => {
    const user = FAKE_USERS[key];
    for (const action of ACTIONS) {
      expect(allowedTeams(user, action), action).toBe(
        SEED_EXPECTED[key][action],
      );
    }
  });
});

describe("열람 범위·수정 권한 조합", () => {
  it("겸직 팀원: 생산·서비스 둘 다 열람, 수정 불가", () => {
    expect(allowedTeams(FAKE_USERS.dual, "view")).toBe("PS");
    expect(allowedTeams(FAKE_USERS.dual, "edit")).toBe("");
  });

  it("겸직 팀장: 수정 권한은 체크한 팀만", () => {
    const leader = fakeUser("prodLeader", {
      viewTeams: ["production", "service"],
      editTeams: ["service"],
    });
    expect(allowedTeams(leader, "view")).toBe("PS");
    expect(allowedTeams(leader, "edit")).toBe("S");
    expect(allowedTeams(leader, "confirm")).toBe("S");
  });

  it("생산팀과 서비스팀은 서로의 페이지를 볼 수 없다", () => {
    expect(can(FAKE_USERS.prodLeader, "view", "service")).toBe(false);
    expect(can(FAKE_USERS.svcMember, "view", "production")).toBe(false);
  });

  it("팀장·팀원은 경영지원(메인)을 볼 수 없다 — 범위 데이터가 어긋나도", () => {
    for (const key of ["prodLeader", "svcMember", "dual"] as const) {
      expect(can(FAKE_USERS[key], "view", "management")).toBe(false);
    }
  });

  it("팀장의 수정 권한은 열람 범위 안에서만 (데이터가 어긋나도 막는다)", () => {
    const odd = fakeUser("prodLeader", {
      viewTeams: ["production"],
      editTeams: ["production", "service"],
    });
    expect(can(odd, "edit", "service")).toBe(false);
    expect(can(odd, "view", "service")).toBe(false);
  });

  it("팀원은 수정 권한 데이터가 있어도 수정 불가", () => {
    const odd = fakeUser("prodMember", { editTeams: ["production"] });
    expect(can(odd, "edit", "production")).toBe(false);
  });

  it("열람 범위가 비어 있는 팀장·팀원은 아무것도 못 본다", () => {
    const empty = fakeUser("svcLeader", { viewTeams: [], editTeams: [] });
    for (const action of ACTIONS) expect(allowedTeams(empty, action)).toBe("");
  });
});

describe("계정 상태", () => {
  it.each(Object.keys(FAKE_USERS) as FakeUserKey[])(
    "비활성 계정(%s)은 모든 동작 불가",
    (key) => {
      const inactive = fakeUser(key, { active: false });
      for (const action of ACTIONS) {
        expect(allowedTeams(inactive, action)).toBe("");
      }
      expect(canManageUsers(inactive)).toBe(false);
    },
  );

  it("초기 비밀번호를 아직 안 바꾼 계정은 모든 동작 불가 (관리자 포함)", () => {
    const admin = fakeUser("admin", { mustChangePassword: true });
    for (const action of ACTIONS) expect(allowedTeams(admin, action)).toBe("");
    expect(canManageUsers(admin)).toBe(false);
  });
});

describe("canManageUsers — 관리자 설정", () => {
  it("관리자만", () => {
    expect(canManageUsers(FAKE_USERS.admin)).toBe(true);
    for (const key of [
      "mgmt",
      "prodLeader",
      "prodMember",
      "svcLeader",
      "svcMember",
      "dual",
    ] as const) {
      expect(canManageUsers(FAKE_USERS[key])).toBe(false);
    }
  });
});
