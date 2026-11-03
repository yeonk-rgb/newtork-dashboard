// 제조내역 업로드 Server Action 권한 — 팀원은 파일을 읽기 전에 거부 (미리보기·저장 모두)
import { describe, expect, it, vi } from "vitest";

import { FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
let currentUser: AppUser | null = null;
vi.mock("@/shared/auth", async () => {
  const { can, canManageUsers } = await import("@/shared/auth/can");
  return {
    getCurrentUser: async () => currentUser,
    can,
    canManageUsers,
    loadUserNames: async () => () => "",
  };
});
const readTableFile = vi.fn();
vi.mock("@/shared/upload/read-table", () => ({
  readTableFile: (...args: unknown[]) => readTableFile(...args),
}));
vi.mock("@/shared/db/client", () => ({ prisma: {} }));

const { previewProductionUpload, saveProductionUpload } =
  await import("./actions");
const { NO_EDIT_MESSAGE } = await import("../rules");

function form() {
  const f = new FormData();
  f.set("file", new File(["x"], "제조내역.xlsx"));
  f.set("overwrite", "[]");
  return f;
}

describe("생산팀원은 업로드 미리보기·저장이 거부된다", () => {
  it.each(["prodMember", "svcMember", "dual"] as const)("%s", async (key) => {
    currentUser = FAKE_USERS[key];
    expect(await previewProductionUpload(form())).toEqual({
      ok: false,
      message: NO_EDIT_MESSAGE,
    });
    expect(await saveProductionUpload(form())).toEqual({
      ok: false,
      message: NO_EDIT_MESSAGE,
    });
    expect(readTableFile).not.toHaveBeenCalled();
  });

  it("생산팀장은 파일 읽기까지 간다", async () => {
    currentUser = FAKE_USERS.prodLeader;
    readTableFile.mockResolvedValueOnce({ ok: false, error: "읽기 실패" });
    expect(await previewProductionUpload(form())).toEqual({
      ok: false,
      message: "읽기 실패",
    });
    expect(readTableFile).toHaveBeenCalledTimes(1);
  });
});
