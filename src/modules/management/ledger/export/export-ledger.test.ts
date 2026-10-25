// 채권·채무 엑셀 다운로드 — 받은 사람·기간 기록, 기록 실패 시 다운로드도 막기
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_ROWS } from "./test-rows";

vi.mock("server-only", () => ({}));
vi.mock("../../data/load-summary-input", () => ({
  getNow: async () => new Date("2026-10-25T03:00:00Z"),
  getTodayKst: async () => new Date("2026-10-25T00:00:00Z"),
}));
vi.mock("../load-ledger", () => ({
  loadLedgerRowsByMonth: async () => new Map([["2026-10", SAMPLE_ROWS]]),
}));
let failAudit = false;
const create = vi.fn(async ({ data }: { data: unknown }) => {
  if (failAudit) throw new Error("DB 연결 끊김");
  return data;
});
vi.mock("@/shared/db/client", () => ({ prisma: { auditLog: { create } } }));

const { exportLedger, LedgerExportError } = await import("./export-ledger");
const ACTOR = { id: "u-mgmt", loginId: "mgmt_member" };

beforeEach(() => {
  failAudit = false;
  create.mockClear();
});

describe("엑셀 다운로드 변경 기록", () => {
  it("EXPORT 1건 — 기간·파일명·시트·행 수", async () => {
    const file = await exportLedger("2026-Q4", ACTOR);
    expect(file.body.length).toBeGreaterThan(1000);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({
      area: "management",
      screen: "ledger-export",
      action: "EXPORT",
      targetType: "LedgerExport",
      targetId: "2026-Q4",
      targetLabel: "채권·채무 엑셀 다운로드 · 2026-Q4",
      actorLoginId: "mgmt_member",
      meta: {
        period: "2026-Q4",
        fileName: "경영지원_관리_2026-Q4.xlsx",
        sheets: ["2026-10"],
        sheetCount: 1,
        rows: SAMPLE_ROWS.length,
      },
    });
  });

  it("기록이 실패하면 다운로드도 막는다 (503 안내)", async () => {
    failAudit = true;
    const error = await exportLedger("2026-10", ACTOR).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LedgerExportError);
    expect(error).toMatchObject({
      status: 503,
      message: expect.stringContaining("다운로드 기록을 남기지 못해"),
    });
  });

  it("연초 누적: 파일 이름 _2026-01~10, 시트는 데이터 있는 달", async () => {
    const file = await exportLedger("2026-YTD10", ACTOR);
    expect(file).toMatchObject({
      fileName: "경영지원_관리_2026-01~10.xlsx",
      asciiName: "ledger-2026-YTD10.xlsx",
      sheetNames: ["2026-10"],
    });
  });

  it("기간이 틀리면 기록하지 않는다", async () => {
    await expect(exportLedger("2026-13", ACTOR)).rejects.toMatchObject({
      status: 400,
    });
    expect(create).not.toHaveBeenCalled();
  });
});
