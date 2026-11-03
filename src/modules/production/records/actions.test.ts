// 생산 수정 Server Action 권한 — 팀원·다른 팀은 DB 에 닿기 전에 거부, 팀장·관리자는 통과 (2026-11-03 생산 예외 되돌림)
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

const recordCount = vi.fn(async () => 1);
const transaction = vi.fn(async (fn: (tx: unknown) => unknown) =>
  fn({
    prodOrderCategory: {
      findUnique: async () => null,
      upsert: async () => ({}),
      delete: async () => ({}),
    },
    auditLog: { create: async () => ({}) },
  }),
);
vi.mock("@/shared/db/client", () => ({
  prisma: {
    prodRecord: { count: () => recordCount() },
    $transaction: (fn: (tx: unknown) => unknown) => transaction(fn),
  },
}));

const { hideRecord, restoreRecord, setOrderCategory, updateRecord } =
  await import("./actions");
const { NO_EDIT_MESSAGE } = await import("../rules");

const EDIT_INPUT = {
  id: "r1",
  updatedAt: "2026-11-03T00:00:00.000Z",
  quantity: "1",
  category: "",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("생산팀원은 수정 Server Action 이 거부된다", () => {
  for (const key of ["prodMember", "svcMember", "svcLeader", "dual"] as const) {
    it(`${key}: 수정·숨김·복구·사업구분 모두 거부, DB 조회 없음`, async () => {
      currentUser = FAKE_USERS[key];
      for (const result of [
        await updateRecord(EDIT_INPUT),
        await hideRecord("r1"),
        await restoreRecord("r1"),
        await setOrderCategory("26001", "WATER"),
      ]) {
        expect(result).toEqual({ ok: false, message: NO_EDIT_MESSAGE });
      }
      expect(recordCount).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });
  }

  it("로그인 안 함도 거부", async () => {
    currentUser = null;
    expect((await setOrderCategory("26001", "WATER")).ok).toBe(false);
  });
});

describe("생산팀장·관리자·경영지원팀은 통과", () => {
  for (const key of ["prodLeader", "admin", "mgmt"] as const) {
    it(`${key}: 사업구분 지정 저장`, async () => {
      currentUser = FAKE_USERS[key];
      const result = await setOrderCategory("26001", "WATER");
      expect(result).toEqual({ ok: true, message: "26001: 상하수도" });
      expect(transaction).toHaveBeenCalledTimes(1);
    });
  }
});
