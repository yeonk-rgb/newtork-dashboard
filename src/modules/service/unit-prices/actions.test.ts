// 단가 Server Action 권한·검증 — 서비스팀원·생산팀은 DB 에 닿기 전에 거부, 팀장은 수정·업로드, 숨김은 confirm
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/shared/time/now", () => ({
  getNow: async () => new Date("2026-11-05T01:00:00Z"),
}));
let currentUser: AppUser | null = null;
vi.mock("@/shared/auth", async () => {
  const { can, canManageUsers } = await import("@/shared/auth/can");
  return { getCurrentUser: async () => currentUser, can, canManageUsers };
});

const audit = vi.fn(async (a: unknown) => a);
const updateMany = vi.fn(async () => ({ count: 1 }));
const created: unknown[] = [];
const tx = {
  svcPriceItem: {
    findUnique: vi.fn(async () => ({
      id: "i1",
      partNo: "VX-05-A-01",
      name: "Motor",
      basePrice: 500000n,
      deletedAt: null,
    })),
    updateMany,
    findMany: vi.fn(async () => [] as unknown[]),
    aggregate: async () => ({ _max: { sortOrder: 3 } }),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data);
      return { id: "new", ...data };
    },
  },
  auditLog: { create: (a: unknown) => audit(a) },
};
const transaction = vi.fn(async (fn: (t: unknown) => unknown) => fn(tx));
vi.mock("@/shared/db/client", () => ({
  prisma: { $transaction: (fn: (t: unknown) => unknown) => transaction(fn) },
}));

const a = await import("./actions");
const u = await import("./upload-actions");
const { NO_EDIT_MESSAGE } = await import("../rules");

const csvForm = () => {
  const fd = new FormData();
  fd.set("kind", "items");
  fd.set(
    "file",
    new File(["파트넘버,품목,기준단가\nVX-1,가,1\n"], "a.csv", {
      type: "text/csv",
    }),
  );
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  created.length = 0;
});

describe("서비스팀원·생산팀은 모두 거부 (DB 접근 없음)", () => {
  for (const key of ["svcMember", "prodLeader", "prodMember"] as const) {
    it(key, async () => {
      currentUser = FAKE_USERS[key];
      for (const r of [
        await a.updateBasePrice("i1", "2026-11-05T00:00:00.000Z", "1000"),
        await a.createPriceItem({ partNo: "VX-1", name: "가" }),
        await a.setPriceItemHidden("i1", true),
        await a.setPriceQuoteHidden("q1", true),
        await u.previewUnitPriceUpload(csvForm()),
        await u.saveUnitPriceUpload(csvForm()),
      ]) {
        expect(r).toEqual({ ok: false, message: NO_EDIT_MESSAGE });
      }
      expect(transaction).not.toHaveBeenCalled();
    });
  }
});

describe("서비스팀장", () => {
  beforeEach(() => {
    currentUser = FAKE_USERS.svcLeader;
  });

  it("기준값 고치기: 콤마 허용, updatedAt 동시 수정 확인, 변경 이력 1건", async () => {
    const r = await a.updateBasePrice(
      "i1",
      "2026-11-05T00:00:00.000Z",
      "520,000",
    );
    expect(r.ok).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "i1", updatedAt: new Date("2026-11-05T00:00:00.000Z") },
      data: { basePrice: 520000n, updatedById: FAKE_USERS.svcLeader.id },
    });
    const entry = (audit.mock.calls[0][0] as { data: Record<string, unknown> })
      .data;
    expect(entry).toMatchObject({
      screen: "service-unit-prices",
      action: "UPDATE",
    });
  });

  it("기준값 빈칸 = 미입력(null), 글자·음수는 DB 전에 거부", async () => {
    expect(
      (await a.updateBasePrice("i1", "2026-11-05T00:00:00.000Z", "")).ok,
    ).toBe(true);
    expect(updateMany.mock.calls[0]).toMatchObject([
      { data: { basePrice: null } },
    ]);
    transaction.mockClear();
    expect((await a.updateBasePrice("i1", "x", "abc")).ok).toBe(false);
    expect((await a.updateBasePrice("i1", "x", "-5")).ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("다른 사람이 먼저 고쳤으면 충돌 안내", async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    const r = await a.updateBasePrice("i1", "2026-11-05T00:00:00.000Z", "1");
    expect(r).toEqual({
      ok: false,
      message: expect.stringContaining("먼저 수정"),
    });
  });

  it("부품 추가: 같은 부품이 있으면 확인 요청 → 확인하면 덮어씀(변경 이력 UPDATE), 없으면 맨 뒤 순서로 저장", async () => {
    const existing = {
      id: "i1",
      partNo: "VX-05-A-01",
      partKey: "VX05A01",
      itemKey: "VX05A01|MOTOR",
      category: "05 MOTOR",
      name: "Motor",
      appliesTo: "",
      basePrice: 500000n,
      deletedAt: null,
    };
    tx.svcPriceItem.findMany.mockResolvedValueOnce([existing]);
    const ask = await a.createPriceItem({
      partNo: "VX-05-A-01",
      name: "Motor (신형)",
    });
    expect(ask.ok).toBe(false);
    expect(ask.confirm).toContain("덮어쓸까요");

    const update = vi.fn(async () => ({}));
    Object.assign(tx.svcPriceItem, { update });
    tx.svcPriceItem.findMany.mockResolvedValueOnce([existing]);
    const over = await a.createPriceItem(
      { partNo: "VX-05-A-01", name: "Motor (신형)", basePrice: "510,000" },
      true,
    );
    expect(over.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({
        name: "Motor (신형)",
        itemKey: "VX05A01|MOTOR(신형)",
        basePrice: 510000n,
      }),
    });
    expect(
      (audit.mock.calls.at(-1)![0] as { data: { action: string } }).data.action,
    ).toBe("UPDATE");

    const r = await a.createPriceItem({
      category: "05 MOTOR",
      partNo: " vx-05-a-09 ",
      name: "Motor",
      basePrice: "1,000",
    });
    expect(r.ok).toBe(true);
    expect(created[0]).toMatchObject({
      partNo: "vx-05-a-09",
      partKey: "VX05A09",
      itemKey: "VX05A09|MOTOR",
      basePrice: 1000n,
      sortOrder: 4,
    });
  });

  it("부품 추가: 파트넘버·품목 필수", async () => {
    const r = await a.createPriceItem({ partNo: "", name: "" });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors ?? {})).toEqual(["partNo", "name"]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("숨김·복구는 confirm 권한 — 팀장(수정 권한)은 가능", async () => {
    tx.svcPriceItem.findUnique.mockResolvedValueOnce({
      id: "i1",
      partNo: "VX-05-A-01",
      name: "Motor",
      basePrice: 1n,
      deletedAt: null,
    });
    const update = vi.fn(async () => ({}));
    Object.assign(tx.svcPriceItem, { update });
    const r = await a.setPriceItemHidden("i1", true);
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledOnce();
  });
});
