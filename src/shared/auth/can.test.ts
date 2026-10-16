import { describe, expect, it } from "vitest";

import { can } from "./can";
import { DEV_USERS, type DevUserId } from "./dev-users";
import type { Action, Team } from "./types";

const ACTIONS: Action[] = ["view", "edit", "confirm"];
const TEAMS: Team[] = ["management", "production", "service"];

// 기대값: [view, edit, confirm] × [management, production, service]
// ○ = 허용, ✕ = 거부
const EXPECTED: Record<DevUserId, Record<Action, Record<Team, boolean>>> = {
  "dev-admin": {
    view: { management: true, production: true, service: true },
    edit: { management: true, production: true, service: true },
    confirm: { management: true, production: true, service: true },
  },
  "dev-ceo": {
    view: { management: true, production: true, service: true },
    edit: { management: true, production: true, service: true },
    confirm: { management: true, production: true, service: true },
  },
  "dev-mgmt-leader": {
    view: { management: true, production: true, service: true },
    edit: { management: true, production: false, service: false },
    confirm: { management: true, production: false, service: false },
  },
  "dev-mgmt-member": {
    view: { management: true, production: true, service: true },
    edit: { management: true, production: false, service: false },
    confirm: { management: false, production: false, service: false },
  },
  "dev-prod-member": {
    view: { management: false, production: true, service: false },
    edit: { management: false, production: false, service: false },
    confirm: { management: false, production: false, service: false },
  },
};

const cases = DEV_USERS.flatMap((user) =>
  ACTIONS.flatMap((action) =>
    TEAMS.map((team) => ({
      user,
      action,
      team,
      expected: EXPECTED[user.id][action][team],
    })),
  ),
);

describe("can(user, action, team)", () => {
  it("5명 × 3동작 × 3팀 = 45개 케이스", () => {
    expect(cases).toHaveLength(45);
  });

  it.each(cases)(
    "$user.name · $action · $team → $expected",
    ({ user, action, team, expected }) => {
      expect(can(user, action, team)).toBe(expected);
    },
  );

  it("다른 팀 팀장은 자기 팀만 입력·확정, 다른 팀은 열람도 불가", () => {
    const prodLeader = {
      id: "x",
      name: "생산 팀장",
      role: "MEMBER",
      team: "production",
      isLeader: true,
    } as const;
    expect(can(prodLeader, "edit", "production")).toBe(true);
    expect(can(prodLeader, "confirm", "production")).toBe(true);
    expect(can(prodLeader, "view", "service")).toBe(false);
  });

  it("다른 팀 팀원은 자기 팀 입력 불가 (경영지원팀만 팀원 입력 허용)", () => {
    const serviceMember = {
      id: "y",
      name: "서비스 팀원",
      role: "MEMBER",
      team: "service",
      isLeader: false,
    } as const;
    expect(can(serviceMember, "view", "service")).toBe(true);
    expect(can(serviceMember, "edit", "service")).toBe(false);
  });
});
