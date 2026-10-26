// [경영지원 관리에서 불러오기] Server Action — 읽기만, 입력란을 고칠 수 있는 사람만, 숨긴 행·외상매출금 제외
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";

let currentUser: AppUser | null = FAKE_USERS.mgmt;
vi.mock("@/shared/auth", () => ({ getCurrentUser: async () => currentUser }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("../data/load-summary-input", () => ({
  getNow: async () => new Date("2026-10-25T03:00:00Z"),
  getTodayKst: async () => new Date("2026-10-25T00:00:00Z"),
}));

let ledgerWhere: unknown = null;
const writes = vi.fn();
vi.mock("@/shared/db/client", () => ({
  prisma: {
    monthlyFinance: {
      findUnique: async () => null,
      create: writes,
      updateMany: writes,
    },
    ledgerEntry: {
      findMany: async ({ where }: { where: unknown }) => {
        ledgerWhere = where;
        return [
          {
            kind: "AP",
            amount: 11_000_000n,
            purchaseType: "GOODS",
            expenseType: null,
            autoTransfer: false,
          },
          {
            kind: "ACCRUED_VENDOR",
            amount: 165_000n,
            purchaseType: null,
            expenseType: "OTHER",
            autoTransfer: true,
          },
        ];
      },
    },
    $transaction: writes,
  },
}));

const { loadLedgerForEntry } = await import("./actions");

beforeEach(() => {
  currentUser = FAKE_USERS.mgmt;
  ledgerWhere = null;
  writes.mockClear();
});

describe("loadLedgerForEntry", () => {
  it("그 달 외상매입금·미지급비용 행 (숨긴 행 제외), 금액은 문자열, DB 쓰기 없음", async () => {
    const res = await loadLedgerForEntry({ year: 2026, month: 9 });
    expect(res).toEqual({
      ok: true,
      rows: [
        {
          kind: "AP",
          amount: "11000000",
          purchaseType: "GOODS",
          expenseType: null,
          autoTransfer: false,
        },
        {
          kind: "ACCRUED_VENDOR",
          amount: "165000",
          purchaseType: null,
          expenseType: "OTHER",
          autoTransfer: true,
        },
      ],
    });
    expect(ledgerWhere).toEqual({
      year: 2026,
      month: 9,
      kind: { in: ["AP", "ACCRUED_STAFF", "ACCRUED_VENDOR"] },
      deletedAt: null,
    });
    expect(writes).not.toHaveBeenCalled();
  });

  it("월간 입력을 고칠 수 없는 사람·미래 달·잘못된 값은 거부", async () => {
    currentUser = FAKE_USERS.prodMember;
    expect(await loadLedgerForEntry({ year: 2026, month: 9 })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    currentUser = FAKE_USERS.mgmt;
    expect(await loadLedgerForEntry({ year: 2026, month: 11 })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(await loadLedgerForEntry({ year: 2026, month: 13 })).toMatchObject({
      ok: false,
      code: "INVALID",
    });
    currentUser = null;
    expect(await loadLedgerForEntry({ year: 2026, month: 9 })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(ledgerWhere).toBeNull();
  });
});
