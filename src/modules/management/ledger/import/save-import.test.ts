// 경영지원 관리 엑셀 이관 저장 — 요약 변경 기록 1건(업로드 id 연결), 기록 실패 시 이관 전체 취소
import { beforeEach, describe, expect, it, vi } from "vitest";

import { transactionalFake } from "../../audit-testing";
import { buildImportPlan, EMPTY_CHOICES } from "./plan";
import { OPTS, parseFixture } from "./test-helpers";

vi.mock("server-only", () => ({}));

let fake = makeFake();
function makeFake() {
  return transactionalFake({
    ledgerEntry: {
      count: async () => 6,
      updateMany: async () => ({ count: 6 }),
      createMany: async ({ data }: { data: unknown[] }) => ({
        count: data.length,
      }),
    },
    dataUpload: { create: async () => ({ id: "up-1" }) },
  });
}
vi.mock("@/shared/db/client", () => ({
  get prisma() {
    return fake.db;
  },
}));

const { saveLedgerImport } = await import("./save-import");

async function input() {
  const parsed = await parseFixture("ledger-sample.xlsx");
  const ap = parsed.blocks.find((b) => b.kind === "AP")!.rows;
  const plan = buildImportPlan(
    parsed,
    {
      ...EMPTY_CHOICES,
      purchaseType: Object.fromEntries(
        ap.map((r) => [r.row, "GOODS" as const]),
      ),
    },
    { ...OPTS, mode: "overwrite", existingTotal: 6 },
  );
  return {
    userId: "u-mgmt",
    loginId: "mgmt_member",
    now: new Date("2026-10-25T03:00:00Z"),
    year: 2026,
    month: 10,
    mode: "overwrite" as const,
    expectedExisting: 6,
    fileName: "경영지원 관리.xlsx",
    fileSha256: "a".repeat(64),
    sheetName: "Sheet1",
    plan,
    excludedRows: 0,
  };
}

beforeEach(() => {
  fake = makeFake();
});

describe("경영지원 관리 엑셀 이관 변경 기록", () => {
  it("요약 1건 — 업로드 id·파일명·기준년월·방식·건수·숨긴 행 수", async () => {
    await saveLedgerImport(await input());
    expect(fake.audits).toEqual([
      expect.objectContaining({
        area: "management",
        screen: "ledger-import",
        action: "IMPORT",
        targetType: "DataUpload",
        targetId: "up-1",
        targetLabel: "경영지원 관리 엑셀 이관 · 2026-10 · 경영지원 관리.xlsx",
        actorLoginId: "mgmt_member",
        changes: [],
        meta: expect.objectContaining({
          uploadId: "up-1",
          fileName: "경영지원 관리.xlsx",
          month: "2026-10",
          mode: "덮어쓰기",
          savedRows: 16,
          hiddenRows: 6,
        }),
      }),
    ]);
    expect(fake.committed).toEqual([
      "ledgerEntry.updateMany",
      "dataUpload.create",
      "ledgerEntry.createMany",
      "auditLog.create",
    ]);
  });

  it("기록이 실패하면 이관 전체(숨김·이력·행 저장)가 취소된다", async () => {
    fake.setAuditFailure(new Error("기록 실패"));
    await expect(saveLedgerImport(await input())).rejects.toThrow("기록 실패");
    expect(fake.committed).toEqual([]);
  });
});
