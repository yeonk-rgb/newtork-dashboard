// 관리자 설정 Server Action 을 직접 호출 — 화면을 거치지 않아도 관리자가 아니면 막히는지 확인
// DB·세션·해시는 가짜 (호출 여부만 확인)
import { beforeEach, describe, expect, it, vi } from "vitest";

import { canManageUsers } from "@/shared/auth/can";
import { FAKE_USERS, fakeUser } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";

let currentUser: AppUser | null = null;
const hashPassword = vi.fn(async (pw: string) => `hashed:${pw.length}`);
const deleteUserSessions = vi.fn<(userId: string) => Promise<void>>(
  async () => {},
);
vi.mock("@/shared/auth", () => ({
  getCurrentUser: async () => currentUser,
  canManageUsers,
  hashPassword: (pw: string) => hashPassword(pw),
  generateTempPassword: () => "TempPw23abcd",
  deleteUserSessions: (id: string) => deleteUserSessions(id),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/shared/time/now", () => ({
  getNow: async () => new Date("2026-10-21T01:00:00Z"),
}));

const UPDATED = new Date("2026-10-20T00:00:00Z");
type Row = { id: string; role: string; deactivatedAt: Date | null };
let rows: Row[] = [];

const db = {
  authUser: {
    findMany: vi.fn(async () => rows),
    findUnique: vi.fn(
      async ({ where }: { where: { id?: string; loginId?: string } }) => {
        const row = rows.find(
          (r) => r.id === where.id || r.id === where.loginId,
        );
        return row
          ? { ...row, name: "직원", loginId: row.id, updatedAt: UPDATED }
          : null;
      },
    ),
    update: vi.fn<(args: unknown) => Promise<object>>(async () => ({})),
    updateMany: vi.fn(async ({ where }: { where: { updatedAt?: Date } }) => ({
      count:
        !where.updatedAt || where.updatedAt.getTime() === UPDATED.getTime()
          ? 1
          : 0,
    })),
    create: vi.fn<(args: unknown) => Promise<object>>(async () => ({})),
  },
  authSession: { deleteMany: vi.fn(async () => ({ count: 0 })) },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
};
vi.mock("@/shared/db/client", () => ({ prisma: db }));

const actions = await import("./actions");

/** 가짜 DB 함수 i번째 호출의 data 인자 */
const dataOf = (fn: { mock: { calls: unknown[][] } }, i = 0) =>
  (fn.mock.calls[i][0] as { data: Record<string, unknown> }).data;

const allDbMocks = () => [
  ...Object.values(db.authUser),
  db.authSession.deleteMany,
  db.$transaction,
];

const ISO = UPDATED.toISOString();
const CALLS = {
  "권한 변경": () =>
    actions.saveUserChanges({
      changes: [
        {
          id: "u-prod-member",
          role: "ADMIN",
          viewTeams: [],
          editTeams: [],
          expectedUpdatedAt: ISO,
        },
      ],
    }),
  "비밀번호 초기화": () => actions.resetUserPassword({ id: "u-prod-member" }),
  "계정 추가": () =>
    actions.createUser({
      loginId: "new_user",
      name: "새직원",
      role: "ADMIN",
      viewTeams: [],
      editTeams: [],
    }),
  비활성화: () => actions.deactivateUser({ id: "u-admin" }),
  복구: () => actions.restoreUser({ id: "u-old" }),
};

beforeEach(() => {
  vi.clearAllMocks();
  rows = [
    { id: "u-admin", role: "ADMIN", deactivatedAt: null },
    { id: "u-prod-member", role: "MEMBER", deactivatedAt: null },
    { id: "u-svc-leader", role: "LEADER", deactivatedAt: null },
    { id: "u-old", role: "MEMBER", deactivatedAt: UPDATED },
  ];
});

describe("관리자가 아니면 모든 관리자 동작 거부 (DB·해시 호출 없음)", () => {
  const actors: [string, AppUser | null][] = [
    ["로그인 안 함", null],
    ["경영지원팀", FAKE_USERS.mgmt],
    ["생산 팀장", FAKE_USERS.prodLeader],
    ["생산 팀원", FAKE_USERS.prodMember],
    ["서비스 팀장", FAKE_USERS.svcLeader],
    ["서비스 팀원", FAKE_USERS.svcMember],
    ["겸직 팀원", FAKE_USERS.dual],
    ["비활성 관리자", fakeUser("admin", { active: false })],
    ["초기 비밀번호 관리자", fakeUser("admin", { mustChangePassword: true })],
  ];
  const cases = actors.flatMap(([who, user]) =>
    Object.entries(CALLS).map(([what, call]) => ({ who, user, what, call })),
  );

  it.each(cases)("$who · $what → FORBIDDEN", async ({ user, call }) => {
    currentUser = user;
    const result = await call();
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    for (const fn of allDbMocks()) expect(fn).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
    expect(deleteUserSessions).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty("tempPassword");
  });
});

describe("관리자", () => {
  beforeEach(() => {
    currentUser = FAKE_USERS.admin;
  });

  it("직원 권한 변경 저장 (범위는 역할에 맞게 정리)", async () => {
    const result = await actions.saveUserChanges({
      changes: [
        {
          id: "u-prod-member",
          role: "LEADER",
          viewTeams: ["service", "production"],
          editTeams: ["production"],
          expectedUpdatedAt: ISO,
        },
        {
          id: "u-svc-leader",
          role: "MEMBER",
          viewTeams: ["service"],
          editTeams: ["service"],
          expectedUpdatedAt: ISO,
        },
      ],
    });
    expect(result).toMatchObject({ ok: true });
    expect(db.authUser.updateMany).toHaveBeenCalledTimes(2);
    expect([0, 1].map((i) => dataOf(db.authUser.updateMany, i))).toEqual([
      {
        role: "LEADER",
        viewTeams: ["production", "service"],
        editTeams: ["production"],
        updatedById: "u-admin",
      },
      {
        role: "MEMBER",
        viewTeams: ["service"],
        editTeams: [],
        updatedById: "u-admin",
      },
    ]);
  });

  it("본인 역할은 바꿀 수 없다", async () => {
    const result = await actions.saveUserChanges({
      changes: [
        {
          id: "u-admin",
          role: "MEMBER",
          viewTeams: ["production"],
          editTeams: [],
          expectedUpdatedAt: ISO,
        },
      ],
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(db.authUser.updateMany).not.toHaveBeenCalled();
  });

  it("마지막 관리자 유지 — 동시 수정으로 관리자가 0명이 되면 거부", async () => {
    // 다른 관리자가 방금 본인(u-admin)을 경영지원팀으로 내린 상태에서, 본인이 마지막 관리자 u-x 를 내리려 함
    rows = [
      { id: "u-admin", role: "MANAGEMENT", deactivatedAt: null },
      { id: "u-x", role: "ADMIN", deactivatedAt: null },
    ];
    const result = await actions.saveUserChanges({
      changes: [
        {
          id: "u-x",
          role: "MANAGEMENT",
          viewTeams: [],
          editTeams: [],
          expectedUpdatedAt: ISO,
        },
      ],
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(result.ok ? "" : result.message).toContain("최소 1명");
    expect(db.authUser.updateMany).not.toHaveBeenCalled();

    // 비활성화도 같은 규칙
    const off = await actions.deactivateUser({ id: "u-x" });
    expect(off).toMatchObject({ ok: false, code: "INVALID" });
    expect(db.authUser.update).not.toHaveBeenCalled();
  });

  it("팀장·팀원의 열람 범위가 비면 거부", async () => {
    const result = await actions.saveUserChanges({
      changes: [
        {
          id: "u-prod-member",
          role: "MEMBER",
          viewTeams: [],
          editTeams: [],
          expectedUpdatedAt: ISO,
        },
      ],
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("다른 관리자가 먼저 고쳤으면 충돌 (전부 취소)", async () => {
    const result = await actions.saveUserChanges({
      changes: [
        {
          id: "u-prod-member",
          role: "MEMBER",
          viewTeams: ["production"],
          editTeams: [],
          expectedUpdatedAt: "2026-10-19T00:00:00.000Z",
        },
      ],
    });
    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("비밀번호 초기화: 임시 비밀번호 1회 반환, DB에는 해시, 변경 강제·잠금 해제·로그아웃", async () => {
    const result = await actions.resetUserPassword({ id: "u-prod-member" });
    expect(result).toMatchObject({ ok: true, tempPassword: "TempPw23abcd" });
    const data = dataOf(db.authUser.update);
    expect(data).toMatchObject({
      passwordHash: "hashed:12",
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    });
    expect(JSON.stringify(data)).not.toContain("TempPw23abcd");
    expect(deleteUserSessions).toHaveBeenCalledWith("u-prod-member");
  });

  it("본인·비활성 계정은 초기화 불가", async () => {
    expect(await actions.resetUserPassword({ id: "u-admin" })).toMatchObject({
      ok: false,
      code: "INVALID",
    });
    expect(await actions.resetUserPassword({ id: "u-old" })).toMatchObject({
      ok: false,
      code: "INVALID",
    });
    expect(db.authUser.update).not.toHaveBeenCalled();
  });

  it("계정 추가: 임시 비밀번호 1회 반환, 초기 비밀번호 표시", async () => {
    const result = await actions.createUser({
      loginId: "New_User",
      name: "새직원",
      role: "LEADER",
      viewTeams: ["service"],
      editTeams: ["service", "production"],
    });
    expect(result).toMatchObject({ ok: true, tempPassword: "TempPw23abcd" });
    const data = dataOf(db.authUser.create);
    expect(data).toMatchObject({
      loginId: "new_user",
      role: "LEADER",
      viewTeams: ["service"],
      editTeams: ["service"],
      mustChangePassword: true,
      createdById: "u-admin",
    });
  });

  it("계정 추가: 아이디 형식·중복 거부", async () => {
    const base = {
      name: "x",
      role: "MEMBER" as const,
      viewTeams: ["production" as const],
      editTeams: [],
    };
    expect(
      await actions.createUser({ ...base, loginId: "한글" }),
    ).toMatchObject({ ok: false, code: "INVALID" });
    expect(
      await actions.createUser({ ...base, loginId: "u-old" }),
    ).toMatchObject({ ok: false, code: "INVALID" });
    rows.push({ id: "dup_id", role: "MEMBER", deactivatedAt: null });
    expect(
      await actions.createUser({ ...base, loginId: "dup_id" }),
    ).toMatchObject({
      ok: false,
      message: "이미 있는 아이디입니다.",
    });
    expect(db.authUser.create).not.toHaveBeenCalled();
  });

  it("비활성화: 세션 삭제, 본인·마지막 관리자는 불가", async () => {
    expect(await actions.deactivateUser({ id: "u-prod-member" })).toMatchObject(
      { ok: true },
    );
    expect(db.authSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u-prod-member" },
    });

    expect(await actions.deactivateUser({ id: "u-admin" })).toMatchObject({
      ok: false,
      code: "INVALID",
    });

    rows = [
      { id: "u-admin", role: "ADMIN", deactivatedAt: null },
      { id: "u-admin2", role: "ADMIN", deactivatedAt: null },
    ];
    currentUser = fakeUser("admin", { id: "u-admin" });
    // 관리자 2명 중 다른 1명은 비활성화 가능
    expect(await actions.deactivateUser({ id: "u-admin2" })).toMatchObject({
      ok: true,
    });
  });

  it("복구", async () => {
    expect(await actions.restoreUser({ id: "u-old" })).toMatchObject({
      ok: true,
    });
  });
});
