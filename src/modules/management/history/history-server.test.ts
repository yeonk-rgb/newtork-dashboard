// 변경 이력 서버 쪽 — 조회 조건(관리자 기록 거름), 행 이력(엑셀 이관 줄), 엑셀 내려받기(권한·서식·기록·기록 실패 시 막기)
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";

vi.mock("server-only", () => ({}));
vi.mock("../data/load-summary-input", () => ({
  getNow: async () => new Date("2026-10-25T05:00:00Z"),
  getTodayKst: async () => new Date("2026-10-25T00:00:00Z"),
}));
let currentUser: AppUser | null = FAKE_USERS.mgmt;
vi.mock("@/shared/auth", async () => {
  const { can, canManageUsers } = await import("@/shared/auth/can");
  return { getCurrentUser: async () => currentUser, can, canManageUsers };
});

const LOGS = [
  {
    id: "a2",
    occurredAt: new Date("2026-10-25T04:45:00Z"),
    actorId: "u-mgmt",
    actorLoginId: "mgmt_member",
    screen: "ledger",
    action: "UPDATE",
    targetLabel: "2026-10 외상매출금 · 가나상사(샘플)",
    changes: [
      {
        field: "amount",
        label: "잔액",
        before: "12,500,000원",
        after: "13,000,000원",
      },
      { field: "note", label: "적요", before: null, after: "일부 입금" },
    ],
    meta: null,
  },
  {
    id: "a1",
    occurredAt: new Date("2026-10-25T04:40:00Z"),
    actorId: "u-admin",
    actorLoginId: "admin",
    screen: "admin-users",
    action: "PASSWORD_RESET",
    targetLabel: "최서비스(svc_member)",
    changes: [],
    meta: { result: "초기화함" },
  },
];

const auditFindMany = vi.fn<(args: unknown) => Promise<typeof LOGS>>(
  async () => LOGS,
);
const auditCount = vi.fn<(args: unknown) => Promise<number>>(
  async () => LOGS.length,
);
const auditCreate = vi.fn(async ({ data }: { data: unknown }) => data);
let auditFails = false;
const prisma = {
  auditLog: {
    findMany: auditFindMany,
    count: auditCount,
    groupBy: vi.fn(async () => [
      { actorId: "u-mgmt", actorLoginId: "mgmt_member" },
    ]),
    findFirst: vi.fn(async () => ({
      actorId: "u-mgmt",
      actorLoginId: "mgmt_member",
      occurredAt: new Date("2026-10-25T04:43:00Z"),
    })),
    create: vi.fn(async (args: { data: unknown }) => {
      if (auditFails) throw new Error("DB 연결 끊김");
      return auditCreate(args);
    }),
  },
  authUser: {
    findMany: vi.fn(async () => [
      { id: "u-mgmt", name: "윤경영", loginId: "mgmt_member" },
      { id: "u-admin", name: "김대표", loginId: "admin" },
    ]),
  },
  ledgerEntry: {
    findUnique: vi.fn(async () => ({ uploadId: "up-1" as string | null })),
  },
  dataUpload: {
    findUnique: vi.fn(async () => ({
      fileNames: ["ledger-sample.xlsx"],
      createdById: "u-mgmt",
      createdAt: new Date("2026-10-25T04:43:00Z"),
    })),
  },
};
vi.mock("@/shared/db/client", () => ({ prisma }));

const { loadHistoryPage, loadRowHistory } = await import("./load-history");
const { exportHistory, HistoryExportError } = await import("./export-history");
const { getRowHistory } = await import("./actions");
const { historyAbilities, parseHistoryFilter } = await import("./rules");

const whereOf = (fn: typeof auditFindMany | typeof auditCount, call = 0) =>
  (fn.mock.calls[call][0] as { where: Record<string, unknown> }).where;

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = FAKE_USERS.mgmt;
  auditFails = false;
});

describe("목록 조회 (서버에서 거름)", () => {
  const filter = parseHistoryFilter(
    { screen: "admin-users" },
    new Date("2026-10-25T00:00:00Z"),
  );

  it("경영지원팀: 주소에 관리자 화면을 넣어도 조회 조건에 경영지원·생산 영역만", async () => {
    await loadHistoryPage(filter, historyAbilities(FAKE_USERS.mgmt));
    const teamOnly = { area: { in: ["management", "production", "service"] } };
    expect(whereOf(auditFindMany)).toMatchObject(teamOnly);
    expect(whereOf(auditCount)).toMatchObject(teamOnly);
    // 사람 고르기 목록도 경영지원 기록을 남긴 사람만
    expect(prisma.auditLog.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: teamOnly }),
    );
  });

  it("관리자(대표): area 조건 없음 + 이름(아이디)·한글 화면·문장", async () => {
    const page = await loadHistoryPage(
      { ...filter, screen: null },
      historyAbilities(FAKE_USERS.admin),
    );
    expect(whereOf(auditFindMany)).not.toHaveProperty("area");
    expect(
      page.rows.map((r) => [r.actor, r.screen, r.action, r.lines]),
    ).toEqual([
      [
        "윤경영(mgmt_member)",
        "경영지원 관리",
        "수정",
        ["잔액: 12,500,000원 → 13,000,000원", "적요: (없음) → 일부 입금"],
      ],
      [
        "김대표(admin)",
        "관리자(대표) · 계정 관리",
        "비밀번호 초기화",
        ["비밀번호를 초기화함"],
      ],
    ]);
    expect(page.actors).toEqual([
      { id: "u-mgmt", label: "윤경영(mgmt_member)" },
    ]);
  });
});

describe("행 이력", () => {
  it("그 행 기록만 + area management, 엑셀 이관 행은 맨 아래 '엑셀 이관으로 생성'", async () => {
    auditFindMany.mockResolvedValueOnce([LOGS[0]]);
    const history = await loadRowHistory("LedgerEntry", "le-1");
    expect(whereOf(auditFindMany)).toEqual({
      area: "management",
      targetType: "LedgerEntry",
      targetId: "le-1",
    });
    expect(history.rows).toHaveLength(1);
    expect(history.origin?.text).toBe(
      "엑셀 이관으로 생성 — ledger-sample.xlsx, 윤경영(mgmt_member), 2026-10-25 13:43",
    );
  });

  it("직접 추가한 행·미수금은 이관 줄 없음", async () => {
    prisma.ledgerEntry.findUnique.mockResolvedValueOnce({ uploadId: null });
    expect((await loadRowHistory("LedgerEntry", "le-2")).origin).toBeNull();
    expect((await loadRowHistory("Receivable", "r-1")).origin).toBeNull();
  });

  it("Server Action: 생산팀은 거절, 모르는 대상 종류는 거절", async () => {
    currentUser = FAKE_USERS.prodLeader;
    expect(await getRowHistory({ type: "Receivable", id: "r-1" })).toEqual({
      ok: false,
      message: "권한이 없습니다.",
    });
    currentUser = FAKE_USERS.mgmt;
    expect(
      await getRowHistory({ type: "AuthUser", id: "u-admin" }),
    ).toMatchObject({
      ok: false,
    });
    expect(auditFindMany).not.toHaveBeenCalled();
  });
});

describe("엑셀 내려받기", () => {
  const params = new URLSearchParams({ from: "2026-10-01", to: "2026-10-31" });

  it.each([
    ["경영지원팀", FAKE_USERS.mgmt],
    ["생산 팀장", FAKE_USERS.prodLeader],
  ])("%s: 403, 조회·기록 없음", async (_name, user) => {
    const error = await exportHistory(params, user).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HistoryExportError);
    expect(error).toMatchObject({ status: 403 });
    expect(auditFindMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("관리자(대표): 원본 양식 스타일 + 파일명 + 내려받기 기록", async () => {
    const file = await exportHistory(params, FAKE_USERS.admin);
    expect(file.fileName).toBe("변경이력_2026-10-01_2026-10-31.xlsx");
    expect(file.rowCount).toBe(2);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.body as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).values).toEqual([
      undefined,
      "일시",
      "이름",
      "아이디",
      "화면",
      "동작",
      "대상",
      "바뀐 내용",
    ]);
    const head = ws.getCell("A1");
    expect(head.font).toMatchObject({ name: "맑은 고딕", bold: true });
    expect(head.fill).toMatchObject({ fgColor: { argb: "FFE7E6E6" } });
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();
    expect(ws.getCell("A2").numFmt).toBe("yyyy-mm-dd hh:mm");
    // 한국 시각 13:45 가 엑셀에서도 13:45 로
    expect((ws.getCell("A2").value as Date).toISOString()).toBe(
      "2026-10-25T13:45:00.000Z",
    );
    expect(ws.getCell("G2").value).toBe(
      "잔액: 12,500,000원 → 13,000,000원\n적요: (없음) → 일부 입금",
    );
    expect(ws.getCell("G2").font).toMatchObject({ name: "맑은 고딕" });
    expect(ws.getColumn(7).width).toBeGreaterThan(ws.getColumn(3).width ?? 0);

    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0][0].data).toMatchObject({
      area: "admin",
      screen: "history-export",
      action: "EXPORT",
      actorLoginId: "admin",
      meta: {
        from: "2026-10-01",
        to: "2026-10-31",
        rows: 2,
        fileName: "변경이력_2026-10-01_2026-10-31.xlsx",
      },
    });
  });

  it("기록을 남기지 못하면 내려받기도 막는다 (503)", async () => {
    auditFails = true;
    await expect(exportHistory(params, FAKE_USERS.admin)).rejects.toMatchObject(
      {
        status: 503,
      },
    );
  });

  it("너무 많으면 400 안내", async () => {
    auditCount.mockResolvedValueOnce(10_001);
    await expect(exportHistory(params, FAKE_USERS.admin)).rejects.toMatchObject(
      {
        status: 400,
        message: expect.stringContaining("기간을 줄여"),
      },
    );
  });
});
