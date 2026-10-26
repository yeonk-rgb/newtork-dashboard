// 경영지원 엑셀 다운로드 — 받은 사람·기간 기록, 기록 실패 시 다운로드도 막기
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_CATEGORIES, SAMPLE_MONTHS } from "../entry/export/test-data";
import { SAMPLE_ROWS } from "../ledger/export/test-rows";
import {
  fixtureInput,
  fixtureItemReceivables,
  fixtureMonths,
} from "./testing/summary-fixture";

vi.mock("server-only", () => ({}));
const loadSummary = vi.fn(async (period: Parameters<typeof fixtureInput>[0]) =>
  fixtureInput(period),
);
vi.mock("../data/load-summary-input", () => ({
  getNow: async () => new Date("2026-10-25T03:00:00Z"),
  getTodayKst: async () => new Date("2026-10-25T00:00:00Z"),
  loadSummaryInput: loadSummary,
}));
const loadEntry = vi.fn(async () => ({
  data: SAMPLE_MONTHS,
  categories: SAMPLE_CATEGORIES,
}));
vi.mock("../entry/export/load-entry-export", () => ({
  loadEntryExportData: loadEntry,
}));
vi.mock("../data/queries", () => ({
  loadFinanceMonths: async () => fixtureMonths(),
  // 미수금 건별 기록 엑셀 입력
  loadReceivables: async () => fixtureItemReceivables(),
}));
vi.mock("../ledger/load-ledger", () => ({
  loadLedgerRowsByMonth: async () => new Map([["2026-10", SAMPLE_ROWS]]),
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
  loadSummary.mockClear();
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

describe("목표 대비 실적·미수금 엑셀 다운로드", () => {
  it("목표 대비 실적: 어떤 기간을 골라도 그 해 시트 1장, 파일·기록은 연도", async () => {
    const file = await exportManagementFile("targets", "2026-Q3", ACTOR);
    expect(file).toMatchObject({
      kind: "targets",
      fileName: "경영지원_목표실적_2026.xlsx",
      asciiName: "targets-2026.xlsx",
      period: "2026",
      sheetNames: ["2026"],
    });
    expect(loadSummary.mock.calls[0][0]).toEqual({ unit: "year", year: 2026 });
    expect(create.mock.calls[0][0].data).toMatchObject({
      screen: "targets-export",
      action: "EXPORT",
      targetType: "TargetsExport",
      targetLabel: "목표 대비 실적 엑셀 다운로드 · 2026",
      meta: {
        period: "2026",
        fileName: "경영지원_목표실적_2026.xlsx",
        sheetCount: 1,
      },
    });
  });

  it("미수금: 시트 이름 = 기간 + 미수금 상세, 기록 남김", async () => {
    const file = await exportManagementFile("receivables", "2026-Q3", ACTOR);
    expect(file).toMatchObject({
      fileName: "경영지원_미수금_2026-Q3.xlsx",
      sheetNames: ["2026-Q3", "미수금 상세"],
    });
    expect(create.mock.calls[0][0].data).toMatchObject({
      screen: "receivables-export",
      targetType: "ReceivablesExport",
      targetLabel: "미수금 엑셀 다운로드 · 2026-Q3",
    });
  });

  it("기록이 실패하면 막고(503), 미래 연도는 400", async () => {
    failAudit = true;
    await expect(
      exportManagementFile("receivables", "2026-10", ACTOR),
    ).rejects.toMatchObject({ status: 503 });
    failAudit = false;
    await expect(
      exportManagementFile("targets", "2027", ACTOR),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("월별 리포트 엑셀 다운로드", () => {
  it("당월: 리포트 시트 + 경영지원 관리 시트 + 경영지원 관리 상세, 작성자 이름, 기록", async () => {
    const file = await exportManagementFile("report", "2026-10", {
      ...ACTOR,
      name: "윤경영",
    });
    expect(file).toMatchObject({
      kind: "report",
      fileName: "경영지원_리포트_2026-10.xlsx",
      asciiName: "report-2026-10.xlsx",
      // "미수금 상세"(건별) 시트는 넣지 않음 — 미수금은 경영지원 관리 외상매출금 기준 (2026-10-26)
      sheetNames: ["2026-10", "경영지원 관리 2026-10", "경영지원 관리 상세"],
    });
    expect(create.mock.calls[0][0].data).toMatchObject({
      screen: "report-export",
      targetType: "ReportExport",
      targetLabel: "월별 리포트 엑셀 다운로드 · 2026-10",
      actorLoginId: "mgmt_member",
      meta: { period: "2026-10", sheetCount: 3 },
    });
  });

  it("연초 누적: 파일 _2026-01~10, 합계 리포트 1장 + 데이터 있는 달의 경영지원 관리 시트", async () => {
    const file = await exportManagementFile("report", "2026-YTD10", ACTOR);
    expect(file.fileName).toBe("경영지원_리포트_2026-01~10.xlsx");
    expect(file.sheetNames).toEqual([
      "2026-01~10",
      "경영지원 관리 2026-10",
      "경영지원 관리 상세",
    ]);
  });
});
