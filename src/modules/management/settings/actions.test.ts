// 목표·지출 항목 Server Action — 변경 기록(화면 표기), 기록 실패 시 저장 취소
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";

import { transactionalFake } from "../audit-testing";

vi.mock("server-only", () => ({}));
let currentUser: AppUser | null = FAKE_USERS.mgmt;
vi.mock("@/shared/auth", async () => {
  const { can } = await import("@/shared/auth/can");
  return { getCurrentUser: async () => currentUser, can };
});
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/shared/time/now", () => ({
  getNow: async () => new Date("2026-10-25T03:00:00Z"),
}));

const UPDATED = new Date("2026-10-24T00:00:00Z");
type Target = {
  id: string;
  year: number;
  revenueTarget: bigint;
  q1Target: bigint | null;
  q2Target: bigint | null;
  q3Target: bigint | null;
  q4Target: bigint | null;
  updatedAt: Date;
};
let target: Target | null = null;
type Category = {
  id: string;
  name: string;
  costType: string | null;
  isActive: boolean;
  sortOrder: number;
  updatedAt: Date;
};
let categories: Category[] = [];

let fake = makeFake();
function makeFake() {
  return transactionalFake({
    annualTarget: {
      findUnique: async () => target,
      updateMany: async () => ({ count: 1 }),
      create: async () => ({ id: "t-new" }),
    },
    expenseCategory: {
      findMany: async () => categories,
      update: async () => ({}),
      create: async () => ({ id: "c-new" }),
      delete: async () => ({}),
    },
    otherExpense: {
      count: async () => 0,
      deleteMany: async () => ({ count: 0 }),
    },
  });
}
vi.mock("@/shared/db/client", () => ({
  get prisma() {
    return fake.db;
  },
}));

const actions = await import("./actions");
const { categoriesVersion } = await import("./load-settings");

beforeEach(() => {
  currentUser = FAKE_USERS.mgmt;
  fake = makeFake();
  target = null;
  categories = [
    {
      id: "c-ad",
      name: "광고선전비",
      costType: null,
      isActive: true,
      sortOrder: 1,
      updatedAt: UPDATED,
    },
    {
      id: "c-ent",
      name: "접대비",
      costType: "VARIABLE",
      isActive: true,
      sortOrder: 2,
      updatedAt: UPDATED,
    },
    {
      id: "c-old",
      name: "회의비",
      costType: null,
      isActive: true,
      sortOrder: 3,
      updatedAt: UPDATED,
    },
  ];
});

describe("목표 설정 변경 기록", () => {
  it("처음 저장 → CREATE (연간 120,000,000원, 빈 분기는 '자동 배분')", async () => {
    const res = await actions.saveAnnualTarget({
      year: 2027,
      revenueTarget: "120000000",
      quarters: ["30000000", "", "", ""],
      expectedUpdatedAt: null,
    });
    expect(res.ok).toBe(true);
    expect(fake.audits).toEqual([
      expect.objectContaining({
        screen: "targets",
        action: "CREATE",
        targetType: "AnnualTarget",
        targetLabel: "2027년 목표",
        changes: [
          {
            field: "revenueTarget",
            label: "연간 목표매출액",
            before: null,
            after: "120,000,000원",
          },
          {
            field: "q1Target",
            label: "1분기 목표",
            before: null,
            after: "30,000,000원",
          },
          {
            field: "q2Target",
            label: "2분기 목표",
            before: null,
            after: "자동 배분",
          },
          {
            field: "q3Target",
            label: "3분기 목표",
            before: null,
            after: "자동 배분",
          },
          {
            field: "q4Target",
            label: "4분기 목표",
            before: null,
            after: "자동 배분",
          },
        ],
      }),
    ]);
  });

  it("수정 → 바뀐 칸만", async () => {
    target = {
      id: "t-26",
      year: 2026,
      revenueTarget: 1_000_000_000n,
      q1Target: null,
      q2Target: null,
      q3Target: null,
      q4Target: null,
      updatedAt: UPDATED,
    };
    await actions.saveAnnualTarget({
      year: 2026,
      revenueTarget: "1200000000",
      quarters: ["", "", "", "300000000"],
      expectedUpdatedAt: UPDATED.toISOString(),
    });
    expect(fake.audits.map((a) => [a.action, a.changes])).toEqual([
      [
        "UPDATE",
        [
          {
            field: "revenueTarget",
            label: "연간 목표매출액",
            before: "1,000,000,000원",
            after: "1,200,000,000원",
          },
          {
            field: "q4Target",
            label: "4분기 목표",
            before: "자동 배분",
            after: "300,000,000원",
          },
        ],
      ],
    ]);
  });

  it("기록이 실패하면 목표 저장도 취소된다", async () => {
    fake.setAuditFailure(new Error("기록 실패"));
    await expect(
      actions.saveAnnualTarget({
        year: 2027,
        revenueTarget: "1",
        quarters: ["", "", "", ""],
        expectedUpdatedAt: null,
      }),
    ).rejects.toThrow("기록 실패");
    expect(fake.committed).toEqual([]);
  });

  it("권한이 없으면 저장도 기록도 없음 (기존 동작 그대로)", async () => {
    currentUser = FAKE_USERS.prodLeader;
    const res = await actions.saveAnnualTarget({
      year: 2027,
      revenueTarget: "1",
      quarters: ["", "", "", ""],
      expectedUpdatedAt: null,
    });
    expect(res).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(fake.audits).toEqual([]);
  });
});

describe("그 외 지출 항목 변경 기록", () => {
  const save = (
    items: {
      id: string | null;
      name: string;
      costType: "FIXED" | "VARIABLE" | null;
      isActive: boolean;
    }[],
    deletedIds: string[] = [],
  ) =>
    actions.saveExpenseCategories({
      items,
      deletedIds,
      version: categoriesVersion(categories),
    });

  it("추가·이름 변경·고정/변동·비활성·삭제·순서 변경을 각각 기록", async () => {
    const res = await save(
      [
        { id: "c-ent", name: "접대비", costType: "FIXED", isActive: false },
        { id: "c-ad", name: "광고비", costType: null, isActive: true },
        { id: null, name: "운반비", costType: "VARIABLE", isActive: true },
      ],
      ["c-old"],
    );
    expect(res.ok).toBe(true);
    expect(
      fake.audits.map((a) => [a.action, a.targetLabel, a.changes]),
    ).toEqual([
      [
        "DELETE",
        "회의비",
        [
          { field: "name", label: "항목 이름", before: "회의비", after: null },
          { field: "isActive", label: "사용", before: "사용", after: null },
        ],
      ],
      [
        "UPDATE",
        "접대비",
        [
          {
            field: "costType",
            label: "고정비/변동비",
            before: "변동비",
            after: "고정비",
          },
          { field: "isActive", label: "사용", before: "사용", after: "비활성" },
        ],
      ],
      [
        "UPDATE",
        "광고비",
        [
          {
            field: "name",
            label: "항목 이름",
            before: "광고선전비",
            after: "광고비",
          },
        ],
      ],
      [
        "CREATE",
        "운반비",
        [
          { field: "name", label: "항목 이름", before: null, after: "운반비" },
          {
            field: "costType",
            label: "고정비/변동비",
            before: null,
            after: "변동비",
          },
          { field: "isActive", label: "사용", before: null, after: "사용" },
        ],
      ],
      [
        "UPDATE",
        "그 외 지출 항목 순서",
        [
          {
            field: "order",
            label: "순서",
            before: "광고비, 접대비",
            after: "접대비, 광고비",
          },
        ],
      ],
    ]);
  });

  it("아무것도 안 바꾸고 저장하면 기록 없음", async () => {
    await save([
      { id: "c-ad", name: "광고선전비", costType: null, isActive: true },
      { id: "c-ent", name: "접대비", costType: "VARIABLE", isActive: true },
      { id: "c-old", name: "회의비", costType: null, isActive: true },
    ]);
    expect(fake.audits).toEqual([]);
  });

  it("기록이 실패하면 항목 저장도 취소된다", async () => {
    fake.setAuditFailure(new Error("기록 실패"));
    await expect(
      save([
        { id: "c-ad", name: "광고비", costType: null, isActive: true },
        { id: "c-ent", name: "접대비", costType: "VARIABLE", isActive: true },
        { id: "c-old", name: "회의비", costType: null, isActive: true },
      ]),
    ).rejects.toThrow("기록 실패");
    expect(fake.committed).toEqual([]);
  });
});
