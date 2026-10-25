// 경영지원 엑셀 다운로드 — 받은 사람·기간 기록, 기록 실패 시 다운로드도 막기
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_CATEGORIES, SAMPLE_MONTHS } from "../entry/export/test-data";

vi.mock("server-only", () => ({}));
vi.mock("../data/load-summary-input", () => ({
  getNow: async () => new Date("2026-10-25T03:00:00Z"),
  getTodayKst: async () => new Date("2026-10-25T00:00:00Z"),
}));
const loadEntry = vi.fn(async () => ({
  data: SAMPLE_MONTHS,
  categories: SAMPLE_CATEGORIES,
}));
vi.mock("../entry/export/load-entry-export", () => ({
  loadEntryExportData: loadEntry,
}));
let failAudit = false;
const create = vi.fn(async ({ data }: { data: unknown }) => {
  if (failAudit) throw new Error("DB 연결 끊김");
  return data;
});
vi.mock("@/shared/db/client", () => ({ prisma: { auditLog: { create } } }));

const { exportManagementFile, ManagementExportError } =
  await import("./export-file");
const ACTOR = { id: "u-mgmt", loginId: "mgmt_member" };

beforeEach(() => {
  failAudit = false;
  create.mockClear();
  loadEntry.mockClear();
});

describe("월간 입력 엑셀 다운로드", () => {
  it("EXPORT 1건 — 기간·파일명·시트, 응답 파일 이름", async () => {
    const file = await exportManagementFile("entry", "2026-Q3", ACTOR);
    expect(file).toMatchObject({
      kind: "entry",
      fileName: "경영지원_월간입력_2026-Q3.xlsx",
      asciiName: "entry-2026-Q3.xlsx",
      period: "2026-Q3",
      sheetNames: ["2026-Q3", "2026-07", "2026-08", "2026-09"],
    });
    expect(file.body.length).toBeGreaterThan(1000);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({
      area: "management",
      screen: "entry-export",
      action: "EXPORT",
      targetType: "EntryExport",
      targetId: "2026-Q3",
      targetLabel: "월간 입력 엑셀 다운로드 · 2026-Q3",
      actorLoginId: "mgmt_member",
      meta: {
        period: "2026-Q3",
        fileName: "경영지원_월간입력_2026-Q3.xlsx",
        sheets: ["2026-Q3", "2026-07", "2026-08", "2026-09"],
        sheetCount: 4,
      },
    });
  });

  it("이번 분기는 이번 달까지만 읽는다 (미래 달 제외)", async () => {
    await exportManagementFile("entry", "2026-Q4", ACTOR);
    expect(loadEntry).toHaveBeenCalledWith([{ year: 2026, month: 10 }]);
  });

  it("기록이 실패하면 다운로드도 막는다 (503 안내)", async () => {
    failAudit = true;
    const error = await exportManagementFile("entry", "2026-10", ACTOR).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ManagementExportError);
    expect(error).toMatchObject({
      status: 503,
      message: expect.stringContaining("다운로드 기록을 남기지 못해"),
    });
  });

  it("화면·기간이 틀리거나 미래 기간이면 400, 기록하지 않는다", async () => {
    for (const [kind, period] of [
      ["ledger", "2026-10"],
      [null, "2026-10"],
      ["entry", "2026-13"],
      ["entry", "2026-11"],
      ["entry", "2027"],
    ] as const) {
      await expect(
        exportManagementFile(kind, period, ACTOR),
        `${kind} ${period}`,
      ).rejects.toMatchObject({ status: 400 });
    }
    expect(create).not.toHaveBeenCalled();
  });
});
