// [지난달 내용 불러오기] Server Action — 권한·이번 달 비어 있음·지난달 행 수 확인, 행 추가 + 변경 기록 요약 1건 (한 트랜잭션)
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";

let currentUser: AppUser | null = FAKE_USERS.mgmt;
vi.mock("@/shared/auth", () => ({ getCurrentUser: async () => currentUser }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("../data/load-summary-input", () => ({
  getNow: async () => new Date("2026-10-26T03:00:00Z"),
  getTodayKst: async () => new Date("2026-10-26T00:00:00Z"),
}));

type Row = {
  year: number;
  month: number;
  kind: string;
  arStatus: string | null;
  partnerName: string;
  amount: bigint;
  settledOn: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  [k: string]: unknown;
};
type Audit = { screen: string; action: string; meta: Record<string, unknown> };

const row = (patch: Partial<Row>): Row => ({
  year: 2026,
  month: 9,
  kind: "AR",
  arStatus: "SCHEDULED",
  purchaseType: null,
  expenseType: null,
  autoTransfer: false,
  partnerCode: null,
  partnerName: "가나(가상)",
  amount: 1_000_000n,
  note: null,
  dueOn: null,
  settledOn: null,
  deletedAt: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  ...patch,
});

const rows: Row[] = [];
const audit: Audit[] = [];
let failAudit = false;

function client(state: { rows: Row[]; audit: Audit[] }) {
  const match = (w: { year: number; month: number }) => (r: Row) =>
    r.year === w.year && r.month === w.month && r.deletedAt === null;
  return {
    ledgerEntry: {
      count: async ({ where }: { where: { year: number; month: number } }) =>
        state.rows.filter(match(where)).length,
      findMany: async ({ where }: { where: { year: number; month: number } }) =>
        state.rows.filter(match(where)),
      createMany: async ({ data }: { data: Omit<Row, "deletedAt">[] }) => {
        state.rows.push(...data.map((d) => ({ ...d, deletedAt: null }) as Row));
        return { count: data.length };
      },
    },
    auditLog: {
      create: async ({ data }: { data: Audit }) => {
        if (failAudit) throw new Error("기록 실패");
        state.audit.push(data);
        return data;
      },
    },
  };
}

vi.mock("@/shared/db/client", () => ({
  get prisma() {
    return {
      ...client({ rows, audit }),
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const pending = { rows: [...rows], audit: [...audit] };
        const result = await fn(client(pending));
        rows.splice(0, rows.length, ...pending.rows);
        audit.splice(0, audit.length, ...pending.audit);
        return result;
      },
    };
  },
}));

const { copyPreviousMonth, previewCopyPrevious } =
  await import("./copy-actions");

beforeEach(() => {
  currentUser = FAKE_USERS.mgmt;
  failAudit = false;
  audit.splice(0);
  rows.splice(0);
  rows.push(
    row({ partnerName: "장기(가상)", arStatus: "LONG_OVERDUE" }),
    row({
      partnerName: "수금(가상)",
      arStatus: "COLLECTED",
      amount: 3_000_000n,
      settledOn: new Date("2026-09-25T00:00:00Z"),
    }),
    row({ kind: "AP", arStatus: null, partnerName: "매입(가상)" }),
    row({ partnerName: "숨김(가상)", deletedAt: new Date() }),
  );
});

const october = () => rows.filter((r) => r.month === 10);

describe("previewCopyPrevious", () => {
  it("지난달 숨기지 않은 행 요약 (당월 수금 따로), 쓰기 없음", async () => {
    const p = await previewCopyPrevious({ month: "2026-10" });
    expect(p).toMatchObject({
      ok: true,
      from: "2026-09",
      existing: 0,
      sourceCount: 3,
      collected: { count: 1, amount: "3000000" },
    });
    expect(p.ok && p.kinds[0]).toEqual({
      kind: "AR",
      count: 1,
      amount: "1000000",
    });
    expect(october()).toEqual([]);
  });

  it("권한 없음·미래 달은 거부", async () => {
    currentUser = FAKE_USERS.prodMember;
    expect(await previewCopyPrevious({ month: "2026-10" })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    currentUser = FAKE_USERS.mgmt;
    expect(await previewCopyPrevious({ month: "2026-11" })).toMatchObject({
      ok: false,
      code: "INVALID",
    });
  });
});

describe("copyPreviousMonth", () => {
  it("당월 수금 제외, 완료일 비움, 순서 유지 + 변경 기록 요약 1건", async () => {
    const res = await copyPreviousMonth({
      month: "2026-10",
      includeCollected: false,
      expectedSourceCount: 3,
    });
    expect(res).toMatchObject({ ok: true });
    expect(october().map((r) => r.partnerName)).toEqual([
      "장기(가상)",
      "매입(가상)",
    ]);
    expect(october().every((r) => r.settledOn === null)).toBe(true);
    expect(october().map((r) => r.createdById)).toEqual([
      FAKE_USERS.mgmt.id,
      FAKE_USERS.mgmt.id,
    ]);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      screen: "ledger-copy",
      action: "CREATE",
      meta: {
        month: "2026-10",
        from: "2026-09",
        savedRows: 2,
        collectedRows: 1,
        includeCollected: "제외",
      },
    });
  });

  it("당월 수금 포함 → 당월 수금예정으로", async () => {
    await copyPreviousMonth({
      month: "2026-10",
      includeCollected: true,
      expectedSourceCount: 3,
    });
    expect(october().find((r) => r.partnerName === "수금(가상)")).toMatchObject(
      { arStatus: "SCHEDULED", settledOn: null },
    );
  });

  it("이번 달에 행이 있거나 지난달 행 수가 바뀌었으면 저장하지 않음", async () => {
    rows.push(row({ month: 10, partnerName: "이미(가상)" }));
    expect(
      await copyPreviousMonth({
        month: "2026-10",
        includeCollected: false,
        expectedSourceCount: 3,
      }),
    ).toMatchObject({ ok: false, code: "CONFLICT" });
    rows.pop();
    expect(
      await copyPreviousMonth({
        month: "2026-10",
        includeCollected: false,
        expectedSourceCount: 2,
      }),
    ).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(october()).toEqual([]);
    expect(audit).toEqual([]);
  });

  it("변경 기록이 실패하면 행도 저장되지 않음", async () => {
    failAudit = true;
    await expect(
      copyPreviousMonth({
        month: "2026-10",
        includeCollected: false,
        expectedSourceCount: 3,
      }),
    ).rejects.toThrow("기록 실패");
    expect(october()).toEqual([]);
  });

  it("팀원(열람만)은 저장 불가", async () => {
    currentUser = FAKE_USERS.prodMember;
    expect(
      await copyPreviousMonth({
        month: "2026-10",
        includeCollected: false,
        expectedSourceCount: 3,
      }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});
