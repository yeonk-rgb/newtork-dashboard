// 채권·채무 Server Action — 저장과 변경 기록이 한 트랜잭션인지, 바뀐 칸만 화면 표기로 남는지
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isForbiddenKey } from "@/shared/audit/forbidden";
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
const base = {
  year: 2026,
  month: 10,
  arStatus: null,
  purchaseType: null,
  expenseType: null,
  autoTransfer: false,
  partnerCode: null,
  note: null,
  dueOn: null,
  settledOn: null,
  uploadId: null,
  deletedAt: null,
  deletedById: null,
  createdById: "seed",
  updatedById: "seed",
  createdAt: UPDATED,
  updatedAt: UPDATED,
};
const ROWS = [
  {
    ...base,
    id: "ar1",
    kind: "AR",
    arStatus: "SCHEDULED",
    partnerCode: "0000000087",
    partnerName: "가나상사(가상)",
    amount: 12_500_000n,
  },
  {
    ...base,
    id: "v1",
    kind: "ACCRUED_VENDOR",
    expenseType: "OTHER",
    partnerName: "타파통신(가상)",
    amount: 165_000n,
  },
];

let fake = createFakeTransactionalDb("ledgerEntry", ROWS);
vi.mock("@/shared/db/client", () => ({
  get prisma() {
    return fake.db;
  },
}));

const actions = await import("./actions");
const ISO = UPDATED.toISOString();

const arFields = {
  kind: "AR" as const,
  arStatus: "SCHEDULED" as const,
  partnerCode: "0000000087",
  partnerName: "가나상사(가상)",
  amount: "12500000",
  note: "",
  dueOn: "",
  settledOn: "",
};

beforeEach(() => {
  currentUser = FAKE_USERS.mgmt;
  fake = createFakeTransactionalDb("ledgerEntry", ROWS);
});

describe("추가", () => {
  it("저장과 함께 CREATE 기록 — 대상 이름, 그 구분에 있는 칸만, 화면 표기", async () => {
    const res = await actions.createLedgerEntry({
      year: 2026,
      month: 10,
      fields: { ...arFields, arStatus: "LONG_OVERDUE", note: "작년 납품분" },
    });
    expect(res.ok).toBe(true);
    expect(fake.committed.rows).toHaveLength(3);
    const [log] = fake.committed.audit;
    expect(log).toMatchObject({
      action: "CREATE",
      area: "management",
      screen: "ledger",
      targetType: "LedgerEntry",
      targetLabel: "2026-10 외상매출금 · 가나상사(가상)",
      actorId: FAKE_USERS.mgmt.id,
      actorLoginId: FAKE_USERS.mgmt.loginId,
    });
    expect(log.changes).toEqual([
      {
        field: "partnerCode",
        label: "코드",
        before: null,
        after: "0000000087",
      },
      { field: "arStatus", label: "상태", before: null, after: "장기미수" },
      {
        field: "partnerName",
        label: "거래처명",
        before: null,
        after: "가나상사(가상)",
      },
      { field: "amount", label: "잔액", before: null, after: "12,500,000원" },
      { field: "note", label: "적요", before: null, after: "작년 납품분" },
    ]);
  });

  it("기록이 실패하면 추가도 취소된다", async () => {
    fake.setAuditFailure(new Error("기록 실패"));
    await expect(
      actions.createLedgerEntry({ year: 2026, month: 10, fields: arFields }),
    ).rejects.toThrow("기록 실패");
    expect(fake.committed.rows).toHaveLength(2);
    expect(fake.committed.audit).toHaveLength(0);
  });
});

describe("수정", () => {
  it("바뀐 칸만 (바뀌기 전 → 바뀐 값)", async () => {
    const res = await actions.updateLedgerEntry({
      id: "ar1",
      expectedUpdatedAt: ISO,
      fields: {
        ...arFields,
        arStatus: "COLLECTED",
        settledOn: "2026-10-20",
        amount: "13000000",
      },
    });
    expect(res.ok).toBe(true);
    expect(fake.committed.audit).toHaveLength(1);
    expect(fake.committed.audit[0]).toMatchObject({
      action: "UPDATE",
      targetId: "ar1",
    });
    expect(fake.committed.audit[0].changes).toEqual([
      {
        field: "arStatus",
        label: "상태",
        before: "당월수금예정",
        after: "당월수금완료",
      },
      {
        field: "amount",
        label: "잔액",
        before: "12,500,000원",
        after: "13,000,000원",
      },
      {
        field: "settledOn",
        label: "수금 완료일",
        before: null,
        after: "2026-10-20",
      },
    ]);
  });

  it("바뀐 칸이 없으면 기록하지 않는다 (저장은 됨)", async () => {
    const res = await actions.updateLedgerEntry({
      id: "ar1",
      expectedUpdatedAt: ISO,
      fields: arFields,
    });
    expect(res.ok).toBe(true);
    expect(fake.committed.audit).toHaveLength(0);
  });

  it("자동이체·비용유형은 화면 한글로, 지급 예정일 이름", async () => {
    await actions.updateLedgerEntry({
      id: "v1",
      expectedUpdatedAt: ISO,
      fields: {
        kind: "ACCRUED_VENDOR",
        expenseType: "ADVERTISING",
        autoTransfer: true,
        partnerName: "타파통신(가상)",
        amount: "165000",
        note: "",
        dueOn: "2026-10-31",
        settledOn: "",
      },
    });
    expect(fake.committed.audit[0].changes).toEqual([
      {
        field: "expenseType",
        label: "비용유형",
        before: "기타",
        after: "광고선전비",
      },
      {
        field: "autoTransfer",
        label: "자동이체",
        before: null,
        after: "자동이체",
      },
      {
        field: "dueOn",
        label: "지급 예정일",
        before: null,
        after: "2026-10-31",
      },
    ]);
  });

  it("기록이 실패하면 수정도 취소된다", async () => {
    fake.setAuditFailure(new Error("기록 실패"));
    await expect(
      actions.updateLedgerEntry({
        id: "ar1",
        expectedUpdatedAt: ISO,
        fields: { ...arFields, amount: "1" },
      }),
    ).rejects.toThrow("기록 실패");
    expect(fake.committed.rows.find((r) => r.id === "ar1")?.amount).toBe(
      12_500_000n,
    );
  });

  it("다른 사람이 먼저 저장했으면 CONFLICT, 기록 없음", async () => {
    const res = await actions.updateLedgerEntry({
      id: "ar1",
      expectedUpdatedAt: new Date("2026-10-01T00:00:00Z").toISOString(),
      fields: { ...arFields, amount: "1" },
    });
    expect(res).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(fake.committed.audit).toHaveLength(0);
  });
});

describe("숨김·복구", () => {
  it("숨김 → HIDE, 복구 → RESTORE (바뀐 칸 없이 동작만)", async () => {
    expect(
      (await actions.hideLedgerEntry({ id: "ar1", expectedUpdatedAt: ISO })).ok,
    ).toBe(true);
    const hidden = fake.committed.rows.find((r) => r.id === "ar1")!;
    expect(
      (
        await actions.restoreLedgerEntry({
          id: "ar1",
          expectedUpdatedAt: hidden.updatedAt.toISOString(),
        })
      ).ok,
    ).toBe(true);
    expect(fake.committed.audit.map((a) => [a.action, a.changes])).toEqual([
      ["HIDE", []],
      ["RESTORE", []],
    ]);
  });

  it("권한이 없으면 저장도 기록도 없음", async () => {
    currentUser = FAKE_USERS.prodLeader;
    const res = await actions.hideLedgerEntry({
      id: "ar1",
      expectedUpdatedAt: ISO,
    });
    expect(res.ok).toBe(false);
    expect(fake.committed.audit).toHaveLength(0);
  });
});

it("적요·거래처명에 Pass·session 같은 단어가 있어도 저장·기록된다", async () => {
  const res = await actions.createLedgerEntry({
    year: 2026,
    month: 10,
    fields: {
      kind: "AP",
      purchaseType: "GOODS",
      partnerName: "패스테크(Pass Tech)",
      amount: "1000000",
      note: "Bypass 밸브 교체 (session 점검)",
      dueOn: "",
      settledOn: "",
    },
  });
  expect(res.ok).toBe(true);
  expect(
    fake.committed.rows.some((r) => r.partnerName === "패스테크(Pass Tech)"),
  ).toBe(true);
  expect(fake.committed.audit[0].changes).toEqual(
    expect.arrayContaining([
      {
        field: "partnerName",
        label: "거래처명",
        before: null,
        after: "패스테크(Pass Tech)",
      },
      {
        field: "note",
        label: "적요",
        before: null,
        after: "Bypass 밸브 교체 (session 점검)",
      },
    ]),
  );
});

it("어떤 기록에도 비밀번호·해시·토큰 같은 칸이 없다", async () => {
  await actions.createLedgerEntry({ year: 2026, month: 10, fields: arFields });
  await actions.updateLedgerEntry({
    id: "ar1",
    expectedUpdatedAt: ISO,
    fields: { ...arFields, note: "메모" },
  });
  const keys = fake.committed.audit.flatMap((a) => [
    ...a.changes.map((c) => c.field),
    ...Object.keys(a.meta ?? {}),
  ]);
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.filter(isForbiddenKey)).toEqual([]);
});
