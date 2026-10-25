// 월간 입력 Server Action — 확정·확정 후 수정·확정 취소만 변경 기록, 임시저장은 기록 안 함, 기록 실패 시 저장 취소
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";

import { transactionalFake } from "../audit-testing";

let currentUser: AppUser | null = FAKE_USERS.mgmt;
vi.mock("@/shared/auth", () => ({ getCurrentUser: async () => currentUser }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("../data/load-summary-input", () => ({
  getNow: async () => new Date("2026-10-25T03:00:00Z"),
  getTodayKst: async () => new Date("2026-10-25T00:00:00Z"),
}));

const UPDATED = new Date("2026-10-24T00:00:00Z");
const ZERO = {
  productSales: 0n,
  goodsSales: 0n,
  serviceSales: 0n,
  goodsPurchase: 0n,
  materialPurchase: 0n,
  operatingExpense: 0n,
};
type Finance = typeof ZERO & {
  id: string;
  status: "DRAFT" | "CONFIRMED";
  confirmedAt: Date | null;
  updatedAt: Date;
  otherExpenses: { categoryId: string; amount: bigint }[];
};
let existing: Finance | null = null;
const CATEGORIES = [
  { id: "c-ad", name: "광고선전비", isActive: true },
  { id: "c-ent", name: "접대비", isActive: true },
];

let fake = makeFake();
function makeFake() {
  return transactionalFake({
    monthlyFinance: {
      findUnique: async () => existing,
      updateMany: async ({ where }: { where: { updatedAt: Date } }) => ({
        count:
          existing && where.updatedAt.getTime() === existing.updatedAt.getTime()
            ? 1
            : 0,
      }),
      create: async () => ({ id: "mf-new" }),
    },
    expenseCategory: { findMany: async () => CATEGORIES },
    otherExpense: { upsert: async () => ({}) },
  });
}
vi.mock("@/shared/db/client", () => ({
  get prisma() {
    return fake.db;
  },
}));

const actions = await import("./actions");

const values = (patch: Partial<Record<keyof typeof ZERO, string>> = {}) => ({
  productSales: "",
  goodsSales: "",
  serviceSales: "",
  goodsPurchase: "",
  materialPurchase: "",
  operatingExpense: "",
  ...patch,
});

beforeEach(() => {
  currentUser = FAKE_USERS.mgmt;
  existing = null;
  fake = makeFake();
});

describe("월간 입력 변경 기록", () => {
  it("임시저장은 기록하지 않는다", async () => {
    const res = await actions.saveMonthlyEntry({
      year: 2026,
      month: 9,
      intent: "draft",
      values: values({ productSales: "120000000" }),
      otherExpenses: [],
      expectedUpdatedAt: null,
    });
    expect(res.ok).toBe(true);
    expect(fake.audits).toEqual([]);
  });

  it("확정 → CONFIRM: 상태와 금액을 화면 표기로 (120,000,000원), 그 외 지출은 항목 이름으로", async () => {
    existing = {
      ...ZERO,
      productSales: 100_000_000n,
      id: "mf-9",
      status: "DRAFT",
      confirmedAt: null,
      updatedAt: UPDATED,
      otherExpenses: [{ categoryId: "c-ad", amount: 0n }],
    };
    const res = await actions.saveMonthlyEntry({
      year: 2026,
      month: 9,
      intent: "confirm",
      values: values({ productSales: "120000000" }),
      otherExpenses: [
        { categoryId: "c-ad", amount: "500000" },
        { categoryId: "c-ent", amount: "" },
      ],
      expectedUpdatedAt: UPDATED.toISOString(),
    });
    expect(res.ok).toBe(true);
    expect(fake.audits).toEqual([
      expect.objectContaining({
        area: "management",
        screen: "entry",
        action: "CONFIRM",
        targetType: "MonthlyFinance",
        targetId: "mf-9",
        targetLabel: "2026년 9월 월간 입력",
        changes: [
          { field: "status", label: "상태", before: "임시저장", after: "확정" },
          {
            field: "productSales",
            label: "제품 매출",
            before: "100,000,000원",
            after: "120,000,000원",
          },
          {
            field: "otherExpense",
            label: "그 외 지출 · 광고선전비",
            before: "0원",
            after: "500,000원",
          },
        ],
      }),
    ]);
  });

  it("확정 후 수정 → 바뀐 칸만, 바뀐 게 없으면 기록 안 함", async () => {
    existing = {
      ...ZERO,
      goodsSales: 30_000_000n,
      id: "mf-9",
      status: "CONFIRMED",
      confirmedAt: UPDATED,
      updatedAt: UPDATED,
      otherExpenses: [],
    };
    const same = await actions.saveMonthlyEntry({
      year: 2026,
      month: 9,
      intent: "update-confirmed",
      values: values({ goodsSales: "30000000" }),
      otherExpenses: [],
      expectedUpdatedAt: UPDATED.toISOString(),
    });
    expect(same.ok).toBe(true);
    expect(fake.audits).toEqual([]);

    await actions.saveMonthlyEntry({
      year: 2026,
      month: 9,
      intent: "update-confirmed",
      values: values({ goodsSales: "31500000" }),
      otherExpenses: [],
      expectedUpdatedAt: UPDATED.toISOString(),
    });
    expect(fake.audits.map((a) => [a.action, a.changes])).toEqual([
      [
        "UPDATE_CONFIRMED",
        [
          {
            field: "goodsSales",
            label: "상품 매출",
            before: "30,000,000원",
            after: "31,500,000원",
          },
        ],
      ],
    ]);
  });

  it("확정 취소 → UNCONFIRM (상태 확정 → 임시저장)", async () => {
    existing = {
      ...ZERO,
      id: "mf-9",
      status: "CONFIRMED",
      confirmedAt: UPDATED,
      updatedAt: UPDATED,
      otherExpenses: [],
    };
    const res = await actions.unconfirmMonthlyEntry({
      year: 2026,
      month: 9,
      expectedUpdatedAt: UPDATED.toISOString(),
    });
    expect(res.ok).toBe(true);
    expect(fake.audits).toEqual([
      expect.objectContaining({
        action: "UNCONFIRM",
        changes: [
          { field: "status", label: "상태", before: "확정", after: "임시저장" },
        ],
      }),
    ]);
  });

  it("기록이 실패하면 확정·확정 취소도 취소된다", async () => {
    fake.setAuditFailure(new Error("기록 실패"));
    await expect(
      actions.saveMonthlyEntry({
        year: 2026,
        month: 9,
        intent: "confirm",
        values: values({ productSales: "1" }),
        otherExpenses: [],
        expectedUpdatedAt: null,
      }),
    ).rejects.toThrow("기록 실패");
    existing = {
      ...ZERO,
      id: "mf-9",
      status: "CONFIRMED",
      confirmedAt: UPDATED,
      updatedAt: UPDATED,
      otherExpenses: [],
    };
    await expect(
      actions.unconfirmMonthlyEntry({
        year: 2026,
        month: 9,
        expectedUpdatedAt: UPDATED.toISOString(),
      }),
    ).rejects.toThrow("기록 실패");
    expect(fake.committed).toEqual([]);
  });

  it("다른 사람이 먼저 저장했으면 CONFLICT, 기록 없음 (기존 동작 그대로)", async () => {
    existing = {
      ...ZERO,
      id: "mf-9",
      status: "CONFIRMED",
      confirmedAt: UPDATED,
      updatedAt: UPDATED,
      otherExpenses: [],
    };
    const res = await actions.unconfirmMonthlyEntry({
      year: 2026,
      month: 9,
      expectedUpdatedAt: new Date("2026-10-01T00:00:00Z").toISOString(),
    });
    expect(res).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(fake.audits).toEqual([]);
  });
});
