// 부품·출장지·가격 Server Action 권한·검증 — 서비스팀원·생산팀은 DB 에 닿기 전에 거부
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

const created: unknown[] = [];
const audit = vi.fn(async (entry: unknown) => entry && {});
const tx = {
  svcSite: {
    findUnique: async () => null,
    create: async ({ data }: { data: unknown }) => {
      created.push(data);
      return { id: "s1" };
    },
  },
  auditLog: { create: (a: unknown) => audit(a) },
};
const transaction = vi.fn(async (fn: (t: unknown) => unknown) => fn(tx));
const partFind = vi.fn(async () => null);
vi.mock("@/shared/db/client", () => ({
  prisma: {
    svcPart: { findUnique: () => partFind() },
    $transaction: (fn: (t: unknown) => unknown) => transaction(fn),
  },
}));

const a = await import("./actions");
const { NO_EDIT_MESSAGE } = await import("../rules");

beforeEach(() => {
  vi.clearAllMocks();
  created.length = 0;
});

describe("서비스팀원·생산팀은 모두 거부", () => {
  for (const key of ["svcMember", "prodLeader", "prodMember"] as const) {
    it(key, async () => {
      currentUser = FAKE_USERS[key];
      for (const r of [
        await a.addPart({ name: "Motor" }),
        await a.savePartNote("p1", "2026-11-03T00:00:00.000Z", "x"),
        await a.setPartHidden("p1", true),
        await a.addSite({ name: "가" }),
        await a.updateSite("s1", "2026-11-03T00:00:00.000Z", { name: "가" }),
        await a.setSiteHidden("s1", true),
        await a.importSitesFromReports(),
        await a.savePrice({ siteId: "s1", partId: "p1", unitPrice: "1000" }),
        await a.removePrice("s1", "p1"),
      ]) {
        expect(r).toMatchObject({ ok: false, message: NO_EDIT_MESSAGE });
      }
      expect(transaction).not.toHaveBeenCalled();
      expect(partFind).not.toHaveBeenCalled();
    });
  }
});

describe("검증 (친구 serializer 규칙)", () => {
  beforeEach(() => {
    currentUser = FAKE_USERS.svcLeader;
  });
  it("출장지: 시·도 없이 시·군·구만은 거부", async () => {
    const r = await a.addSite({ name: "가", sigungu: "창원시" });
    expect(r.errors?.region).toBe("시·도를 먼저 고르세요.");
  });
  it("출장지: 다른 시·도의 시·군·구는 거부", async () => {
    const r = await a.addSite({
      name: "가",
      region: "경상남도",
      sigungu: "해운대구",
    });
    expect(r.errors?.sigungu).toBe("경상남도에 없는 시·군·구입니다.");
  });
  it("출장지: 저장 + 변경 이력", async () => {
    const r = await a.addSite({
      name: " 가상처 ",
      region: "경상남도",
      sigungu: "창원시",
    });
    expect(r.ok).toBe(true);
    expect(created[0]).toMatchObject({
      name: "가상처",
      region: "경상남도",
      sigungu: "창원시",
    });
    expect(audit).toHaveBeenCalledTimes(1);
  });
  it("부품명 빈 칸 거부", async () => {
    expect((await a.addPart({ name: " " })).errors?.name).toBe(
      "부품명을 입력하세요.",
    );
  });
  it("가격: 0 이상 정수만", async () => {
    for (const unitPrice of ["-1", "1.5", "만원", ""]) {
      const r = await a.savePrice({ siteId: "s1", partId: "p1", unitPrice });
      expect(r.ok).toBe(false);
    }
    expect(transaction).not.toHaveBeenCalled();
  });
});
