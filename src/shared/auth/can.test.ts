import { describe, expect, it } from "vitest";

import { can } from "./can";
import { FAKE_USERS, fakeUser, type FakeUserKey } from "./testing/fake-users";
import type { Action, Team } from "./types";

const ACTIONS: Action[] = ["view", "edit", "confirm"];
const TEAMS: Team[] = ["management", "production", "service"];

// 기대값: 동작별로 허용되는 팀 (M = 경영지원·메인, P = 생산, S = 서비스)
type Expect = Record<Action, string>;
const EXPECTED: Record<FakeUserKey, Expect> = {
  admin: { view: "MPS", edit: "MPS", confirm: "MPS" },
  // 임시: 이전 "경영지원 팀장"과 같은 권한 (새 규칙은 다음 단계)
  mgmt: { view: "MPS", edit: "M", confirm: "M" },
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

const cases = (Object.keys(EXPECTED) as FakeUserKey[]).flatMap((key) =>
  ACTIONS.flatMap((action) =>
    TEAMS.map((team) => ({
      key,
      action,
      team,
      expected: EXPECTED[key][action].includes(LETTER[team]),
    })),
  ),
);

describe("can(user, action, team)", () => {
  it.each(cases)("$key · $action · $team → $expected", (c) => {
    expect(can(FAKE_USERS[c.key], c.action, c.team)).toBe(c.expected);
  });

  it("비활성 계정은 관리자라도 모두 불가", () => {
    const inactive = fakeUser("admin", { active: false });
    for (const action of ACTIONS) {
      for (const team of TEAMS) expect(can(inactive, action, team)).toBe(false);
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
});
