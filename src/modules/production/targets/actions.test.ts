// 목표 저장 권한 — 생산팀원은 DB 전에 거부, 팀장은 저장 + 바뀐 목표만 이력
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/shared/time/now", () => ({
  getNow: async () => new Date("2026-11-03T05:00:00Z"),
}));
let currentUser: AppUser | null = null;
vi.mock("@/shared/auth", async () => {
  const { can, canManageUsers } = await import("@/shared/auth/can");
  return { getCurrentUser: async () => currentUser, can, canManageUsers };
});
const audit = vi.fn(async (args: unknown) => args);
const tx = {
  prodAnnualTarget: {
    findUnique: async () => ({ annualTarget: 300 }),
    upsert: vi.fn(async () => ({})),
  },
  prodMonthlyTarget: {
    findMany: async () => [{ month: 1, target: 25 }],
    upsert: vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({})),
  },
  auditLog: { create: (args: unknown) => audit(args) },
};
const transaction = vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx));
vi.mock("@/shared/db/client", () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => unknown) => transaction(fn) },
}));

const { saveTargets } = await import("./actions");
const { NO_EDIT_MESSAGE } = await import("../rules");

const INPUT = {
  year: 2026,
  annual: 336,
  monthly: [28, ...Array(11).fill(null)],
};

beforeEach(() => vi.clearAllMocks());

describe("목표 저장", () => {
  it.each(["prodMember", "svcMember", "svcLeader"] as const)(
    "%s: 거부, DB 조회 없음",
    async (key) => {
      currentUser = FAKE_USERS[key];
      expect(await saveTargets(INPUT)).toEqual({
        ok: false,
        message: NO_EDIT_MESSAGE,
      });
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it("생산팀장: 저장, 빈 달은 삭제, 이력은 바뀐 칸만", async () => {
    currentUser = FAKE_USERS.prodLeader;
    expect((await saveTargets(INPUT)).ok).toBe(true);
    expect(tx.prodMonthlyTarget.upsert).toHaveBeenCalledTimes(1);
    expect(tx.prodMonthlyTarget.deleteMany).toHaveBeenCalledTimes(11);
    const changes = (
      audit.mock.calls[0][0] as {
        data: {
          changes: {
            label: string;
            before: string | null;
            after: string | null;
          }[];
        };
      }
    ).data.changes;
    expect(changes).toEqual([
      { field: "annual", label: "연간 목표", before: "300대", after: "336대" },
      { field: "month1", label: "1월 목표", before: "25대", after: "28대" },
    ]);
  });

  it("음수·소수는 거부", async () => {
    currentUser = FAKE_USERS.admin;
    expect((await saveTargets({ ...INPUT, annual: -1 })).ok).toBe(false);
    expect((await saveTargets({ ...INPUT, annual: 1.5 })).ok).toBe(false);
  });
});
