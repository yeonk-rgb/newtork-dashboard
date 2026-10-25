// 기존 엑셀 업로드 저장 — 요약 변경 기록 1건(업로드 id 연결), 기록 실패 시 업로드 전체 취소
import { beforeEach, describe, expect, it, vi } from "vitest";

import { transactionalFake } from "../audit-testing";
import type { UploadPlan } from "./parse-upload";

vi.mock("server-only", () => ({}));

let fake = makeFake();
function makeFake() {
  return transactionalFake({
    dataUpload: { create: async () => ({ id: "up-7" }) },
    annualTarget: { upsert: async () => ({}) },
    expenseCategory: {
      findUnique: async ({ where }: { where: { name: string } }) => ({
        id: `c-${where.name}`,
      }),
      aggregate: async () => ({ _max: { sortOrder: 3 } }),
      create: async () => ({ id: "c-new" }),
    },
    monthlyFinance: { upsert: async () => ({ id: "mf-1" }) },
    otherExpense: {
      upsert: async () => ({}),
      updateMany: async () => ({ count: 0 }),
    },
  });
}
vi.mock("@/shared/db/client", () => ({
  get prisma() {
    return fake.db;
  },
}));

const { saveUploadPlan } = await import("./save-upload");

const PLAN: UploadPlan = {
  targets: [{ year: 2026, revenueTarget: 1_200_000_000n }],
  months: [
    {
      year: 2026,
      month: 9,
      productSales: 1n,
      goodsSales: 0n,
      serviceSales: 0n,
      goodsPurchase: 0n,
      materialPurchase: 0n,
      operatingExpense: 0n,
      advertising: 0n,
      entertainment: 0n,
      otherExpense: 0n,
    },
  ],
  sheets: [],
};
const SOURCE = {
  userId: "u-mgmt",
  loginId: "mgmt_member",
  fileNames: ["2026_실적.xlsx"],
  now: new Date("2026-10-25T03:00:00Z"),
};

beforeEach(() => {
  fake = makeFake();
});

describe("엑셀 업로드 변경 기록", () => {
  it("요약 1건 — 업로드 id·파일명·저장 행 수·목표 연도·월", async () => {
    await saveUploadPlan(PLAN, SOURCE);
    expect(fake.audits).toEqual([
      expect.objectContaining({
        screen: "upload",
        action: "IMPORT",
        targetId: "up-7",
        targetLabel: "엑셀 업로드 · 2026_실적.xlsx",
        meta: {
          uploadId: "up-7",
          fileNames: ["2026_실적.xlsx"],
          savedRows: 2,
          targetYears: [2026],
          months: ["2026-09"],
        },
      }),
    ]);
  });

  it("기록이 실패하면 업로드 전체가 취소된다", async () => {
    fake.setAuditFailure(new Error("기록 실패"));
    await expect(saveUploadPlan(PLAN, SOURCE)).rejects.toThrow("기록 실패");
    expect(fake.committed).toEqual([]);
  });
});
