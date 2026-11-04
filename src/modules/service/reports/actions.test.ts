// 출장보고서 Server Action 권한·검증 — 서비스팀원·생산팀은 DB 에 닿기 전에 거부, 팀장·관리자·경영지원팀은 통과
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/shared/time/now", () => ({
  getNow: async () => new Date("2026-11-03T05:00:00Z"),
}));
let currentUser: AppUser | null = null;
vi.mock("@/shared/auth", async () => {
  const { can, canManageUsers } = await import("@/shared/auth/can");
  return { getCurrentUser: async () => currentUser, can, canManageUsers };
});
vi.mock("../pdf/read-lines", () => ({ readLines: async () => [] }));

const audit = vi.fn(async (entry: unknown) => entry && {});
const created: unknown[] = [];
const tx = {
  svcReport: {
    create: async ({ data }: { data: unknown }) => {
      created.push(data);
      return { id: "new-1" };
    },
  },
  svcReportCompanion: {
    deleteMany: async () => ({}),
    createMany: async () => ({}),
  },
  svcReportProduct: {
    deleteMany: async () => ({}),
    createMany: async () => ({}),
  },
  svcReportPart: { deleteMany: async () => ({}), create: async () => ({}) },
  svcPart: { upsert: async () => ({ id: "p1" }) },
  auditLog: { create: (a: unknown) => audit(a) },
};
const transaction = vi.fn(async (fn: (t: unknown) => unknown) => fn(tx));
const findReport = vi.fn(async () => null);
vi.mock("@/shared/db/client", () => ({
  prisma: {
    svcReport: { findUnique: () => findReport() },
    svcPart: { findMany: async () => [] },
    $transaction: (fn: (t: unknown) => unknown) => transaction(fn),
  },
}));

const actions = await import("./actions");
const { NO_EDIT_MESSAGE } = await import("../rules");
const INPUT = {
  title: "가상 정기 점검",
  address: "경남 창원시 의창구 가상로 1",
};

beforeEach(() => {
  vi.clearAllMocks();
  created.length = 0;
});

describe("서비스팀원·생산팀은 입력·수정·숨김이 거부된다", () => {
  for (const key of [
    "svcMember",
    "prodLeader",
    "prodMember",
    "dual",
  ] as const) {
    it(`${key}: 모두 거부, DB 조회 없음`, async () => {
      currentUser = FAKE_USERS[key];
      const form = new FormData();
      for (const result of [
        await actions.createReport(INPUT),
        await actions.updateReport("r1", "2026-11-03T00:00:00.000Z", INPUT),
        await actions.hideReport("r1"),
        await actions.restoreReport("r1"),
        await actions.uploadAttachments(form),
        await actions.hideAttachment("a1"),
        await actions.previewReportPdf(form),
        await actions.createReportFromPdf(form),
      ]) {
        expect(result).toMatchObject({ ok: false, message: NO_EDIT_MESSAGE });
      }
      expect(transaction).not.toHaveBeenCalled();
      expect(findReport).not.toHaveBeenCalled();
    });
  }
});

describe("서비스팀장·관리자·경영지원팀은 입력 가능", () => {
  for (const key of ["svcLeader", "admin", "mgmt"] as const) {
    it(`${key}: 저장 + 변경 이력 1건, 지역은 주소에서 판정`, async () => {
      currentUser = FAKE_USERS[key];
      const r = await actions.createReport(INPUT);
      expect(r).toMatchObject({ ok: true, id: "new-1" });
      expect(created[0]).toMatchObject({
        region: "경상남도",
        sigungu: "창원시",
      });
      expect(audit).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(audit.mock.calls[0][0])).toContain(
        "service-reports",
      );
    });
  }
});

describe("입력 검증 (친구 ServiceReportSerializer 규칙)", () => {
  beforeEach(() => {
    currentUser = FAKE_USERS.svcLeader;
  });
  it("출장 목적 필수", async () => {
    const r = await actions.createReport({ title: "  " });
    expect(r.ok).toBe(false);
    expect(r.errors?.title).toBe("출장 목적을 입력하세요.");
  });
  it("종료일이 시작일보다 빠르면 거부", async () => {
    const r = await actions.createReport({
      title: "x",
      tripStart: "2026-03-03",
      tripEnd: "2026-03-02",
    });
    expect(r.errors?.tripEnd).toBe("출장 종료일이 시작일보다 빠릅니다.");
  });
  it("다른 시·도의 시·군·구는 거부", async () => {
    const r = await actions.createReport({
      title: "x",
      region: "경상남도",
      sigungu: "해운대구",
    });
    expect(r.errors?.sigungu).toBe("경상남도에 없는 시·군·구입니다.");
  });
  it("같은 부품 두 번은 거부", async () => {
    const r = await actions.createReport({
      title: "x",
      parts: [{ name: "Motor" }, { name: "Motor" }],
    });
    expect(r.message).toContain("같은 부품이 두 번 들어 있습니다.");
    expect(transaction).not.toHaveBeenCalled();
  });
  it("사람이 고른 지역은 주소로 덮어쓰지 않음", async () => {
    await actions.createReport({
      title: "x",
      address: "부산 해운대구",
      region: "경상남도",
      sigungu: "창원시",
    });
    expect(created[0]).toMatchObject({ region: "경상남도", sigungu: "창원시" });
  });
  it("PDF 가 아닌 파일은 거부", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "a.pdf"),
    );
    expect(await actions.previewReportPdf(form)).toEqual({
      ok: false,
      message: "파일 내용이 확장자와 맞지 않습니다.",
    });
  });
});
