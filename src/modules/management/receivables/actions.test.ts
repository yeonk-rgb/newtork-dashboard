// 미수금 Server Action — 저장과 변경 기록이 한 트랜잭션인지, 수금 처리·취소가 화면 표기로 남는지
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";

import { createFakeTransactionalDb } from "../audit-testing";

let currentUser: AppUser | null = FAKE_USERS.mgmt;
vi.mock("@/shared/auth", () => ({ getCurrentUser: async () => currentUser }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("../data/load-summary-input", () => ({
  getNow: async () => new Date("2026-10-25T03:00:00Z"),
  getTodayKst: async () => new Date("2026-10-25T00:00:00Z"),
}));

const UPDATED = new Date("2026-10-24T00:00:00Z");
const ROW = {
  id: "r1",
  customerName: "가나상하수도(가상)",
  occurredOn: new Date("2026-09-01T00:00:00Z"),
  amount: 12_500_000n,
  isCollected: false,
  collectedOn: null as Date | null,
  dueOn: null as Date | null,
  note: null as string | null,
  deletedAt: null,
  deletedById: null,
  createdById: "seed",
  updatedById: "seed",
  createdAt: UPDATED,
  updatedAt: UPDATED,
};

let fake = createFakeTransactionalDb("receivable", [ROW]);
vi.mock("@/shared/db/client", () => ({
  get prisma() {
    return fake.db;
  },
}));

const actions = await import("./actions");
const ISO = UPDATED.toISOString();

beforeEach(() => {
  currentUser = FAKE_USERS.mgmt;
  fake = createFakeTransactionalDb("receivable", [ROW]);
});

describe("미수금 변경 기록", () => {
  it("등록 → CREATE (거래처·발생일·금액·상태)", async () => {
    const res = await actions.createReceivable({
      customerName: "나다산업(가상)",
      occurredOn: "2026-10-01",
      amount: "3300000",
      dueOn: "",
      note: "",
    });
    expect(res.ok).toBe(true);
    const [log] = fake.committed.audit;
    expect(log).toMatchObject({
      action: "CREATE",
      screen: "receivables",
      targetType: "Receivable",
      targetLabel: "나다산업(가상) · 2026-10-01 발생",
    });
    expect(log.changes).toEqual([
      {
        field: "customerName",
        label: "거래처",
        before: null,
        after: "나다산업(가상)",
      },
      {
        field: "occurredOn",
        label: "발생일",
        before: null,
        after: "2026-10-01",
      },
      { field: "amount", label: "금액", before: null, after: "3,300,000원" },
      { field: "isCollected", label: "상태", before: null, after: "미수" },
    ]);
  });

  it("수금 처리 → COLLECT (상태 미수 → 수금 완료, 수금일)", async () => {
    const res = await actions.collectReceivable({
      id: "r1",
      expectedUpdatedAt: ISO,
      collectedOn: "2026-10-20",
    });
    expect(res.ok).toBe(true);
    expect(fake.committed.audit[0]).toMatchObject({
      action: "COLLECT",
      targetLabel: "가나상하수도(가상) · 2026-09-01 발생",
    });
    expect(fake.committed.audit[0].changes).toEqual([
      {
        field: "isCollected",
        label: "상태",
        before: "미수",
        after: "수금 완료",
      },
      {
        field: "collectedOn",
        label: "수금일",
        before: null,
        after: "2026-10-20",
      },
    ]);
  });

  it("수금 취소 → UNCOLLECT (거꾸로)", async () => {
    await actions.collectReceivable({
      id: "r1",
      expectedUpdatedAt: ISO,
      collectedOn: "2026-10-20",
    });
    const after = fake.committed.rows[0];
    const res = await actions.uncollectReceivable({
      id: "r1",
      expectedUpdatedAt: after.updatedAt.toISOString(),
    });
    expect(res.ok).toBe(true);
    expect(fake.committed.audit[1]).toMatchObject({ action: "UNCOLLECT" });
    expect(fake.committed.audit[1].changes).toEqual([
      {
        field: "isCollected",
        label: "상태",
        before: "수금 완료",
        after: "미수",
      },
      {
        field: "collectedOn",
        label: "수금일",
        before: "2026-10-20",
        after: null,
      },
    ]);
  });

  it("수정 → 바뀐 칸만, 숨김 → HIDE", async () => {
    await actions.updateReceivable({
      id: "r1",
      expectedUpdatedAt: ISO,
      customerName: "가나상하수도(가상)",
      occurredOn: "2026-09-01",
      amount: "12500000",
      dueOn: "2026-11-30",
      note: "분할 상환",
      collectedOn: null,
    });
    const after = fake.committed.rows[0];
    await actions.hideReceivable({
      id: "r1",
      expectedUpdatedAt: after.updatedAt.toISOString(),
    });
    expect(
      fake.committed.audit.map((a) => [
        a.action,
        a.changes.map((c) => c.label),
      ]),
    ).toEqual([
      ["UPDATE", ["수금 예정일", "비고"]],
      ["HIDE", []],
    ]);
  });

  it("거래처·비고에 Pass·token 같은 단어가 있어도 등록·기록된다", async () => {
    const res = await actions.createReceivable({
      customerName: "세션테크(Session Tech)",
      occurredOn: "2026-10-02",
      amount: "500000",
      dueOn: "",
      note: "Bypass 라인 token 밸브",
    });
    expect(res.ok).toBe(true);
    expect(fake.committed.audit[0].changes.map((c) => c.after)).toEqual(
      expect.arrayContaining([
        "세션테크(Session Tech)",
        "Bypass 라인 token 밸브",
      ]),
    );
  });

  it("기록이 실패하면 수금 처리도 취소된다", async () => {
    fake.setAuditFailure(new Error("기록 실패"));
    await expect(
      actions.collectReceivable({
        id: "r1",
        expectedUpdatedAt: ISO,
        collectedOn: "2026-10-20",
      }),
    ).rejects.toThrow("기록 실패");
    expect(fake.committed.rows[0].isCollected).toBe(false);
    expect(fake.committed.audit).toHaveLength(0);
  });
});
