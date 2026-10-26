// 테스트 전용 가짜 사용자 — 화면·서버 코드에서 import 하지 않는다 (*.test.ts 에서만)
// 시드 계정 7명(prisma/seed.ts)과 같은 구성
import type { AppUser } from "../types";

const base = { active: true, mustChangePassword: false } as const;

export const FAKE_USERS = {
  admin: {
    ...base,
    id: "u-admin",
    loginId: "admin",
    name: "관리자",
    role: "ADMIN",
    viewTeams: [],
    editTeams: [],
  },
  mgmt: {
    ...base,
    id: "u-mgmt",
    loginId: "mgmt_member",
    name: "윤경영",
    role: "MANAGEMENT",
    viewTeams: [],
    editTeams: [],
  },
  prodLeader: {
    ...base,
    id: "u-prod-leader",
    loginId: "prod_leader",
    name: "김생산",
    role: "LEADER",
    viewTeams: ["production"],
    editTeams: ["production"],
  },
  prodMember: {
    ...base,
    id: "u-prod-member",
    loginId: "prod_member",
    name: "이생산",
    role: "MEMBER",
    viewTeams: ["production"],
    editTeams: [],
  },
  svcLeader: {
    ...base,
    id: "u-svc-leader",
    loginId: "svc_leader",
    name: "박서비스",
    role: "LEADER",
    viewTeams: ["service"],
    editTeams: ["service"],
  },
  svcMember: {
    ...base,
    id: "u-svc-member",
    loginId: "svc_member",
    name: "최서비스",
    role: "MEMBER",
    viewTeams: ["service"],
    editTeams: [],
  },
  dual: {
    ...base,
    id: "u-dual",
    loginId: "dual_member",
    name: "정겸직",
    role: "MEMBER",
    viewTeams: ["production", "service"],
    editTeams: [],
  },
} as const satisfies Record<string, AppUser>;

export type FakeUserKey = keyof typeof FAKE_USERS;

/** 필드 일부만 바꾼 가짜 사용자 */
export function fakeUser(
  key: FakeUserKey,
  overrides: Partial<AppUser> = {},
): AppUser {
  const user = FAKE_USERS[key];
  return {
    ...user,
    viewTeams: [...user.viewTeams],
    editTeams: [...user.editTeams],
    ...overrides,
  };
}

/**
 * "경영지원 입력·임시저장만 가능(확정 불가)" 사용자 — 지금 권한 규칙에는 없는 조합이지만
 * 경영지원 화면 규칙(entryAbilities 등)에 그 분기가 남아 있어 계속 검사한다 (05-14·15).
 * 테스트에서 vi.mock("@/shared/auth/can", …)과 withEditOnlyUser()로 함께 쓴다.
 */
export const EDIT_ONLY_MGMT: AppUser = fakeUser("mgmt", {
  id: "u-mgmt-edit-only",
  name: "경영지원 입력 전용(테스트)",
});

type CanModule = typeof import("../can");

/** can() 을 감싸서 EDIT_ONLY_MGMT 만 "경영지원 view·edit" 으로 판정 */
export function withEditOnlyUser(real: CanModule): CanModule {
  return {
    ...real,
    can: (user, action, team) =>
      user.id === EDIT_ONLY_MGMT.id
        ? team === "management" && action !== "confirm"
        : real.can(user, action, team),
  };
}
