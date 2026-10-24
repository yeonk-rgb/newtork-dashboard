import { describe, expect, it, vi } from "vitest";

import { EDIT_ONLY_MGMT, FAKE_USERS } from "@/shared/auth/testing/fake-users";

import { importAbilities, importFileError, MAX_IMPORT_BYTES } from "./rules";

// EDIT_ONLY_MGMT = 입력만 가능(지금 규칙엔 없는 조합 — 화면 분기 검사용)
vi.mock("@/shared/auth/can", async (importOriginal) => {
  const { withEditOnlyUser } = await import("@/shared/auth/testing/fake-users");
  return withEditOnlyUser(await importOriginal());
});

describe("importAbilities", () => {
  it("관리자·경영지원팀: 가져오기·덮어쓰기", () => {
    for (const user of [FAKE_USERS.admin, FAKE_USERS.mgmt]) {
      expect(importAbilities(user)).toEqual({
        canImport: true,
        canOverwrite: true,
      });
    }
  });

  it("입력만 가능: 추가로 가져오기만 (덮어쓰기 = confirm)", () => {
    expect(importAbilities(EDIT_ONLY_MGMT)).toEqual({
      canImport: true,
      canOverwrite: false,
    });
  });

  it("생산·서비스: 둘 다 불가", () => {
    for (const user of [FAKE_USERS.prodLeader, FAKE_USERS.prodMember]) {
      expect(importAbilities(user)).toEqual({
        canImport: false,
        canOverwrite: false,
      });
    }
  });
});

describe("importFileError", () => {
  it(".xlsx 만, 빈 파일·5MB 초과 거부", () => {
    expect(
      importFileError({ name: "경영지원 관리.XLSX", size: 13880 }),
    ).toBeNull();
    expect(importFileError({ name: "a.xls", size: 10 })).toContain(".xlsx");
    expect(importFileError({ name: "a.xlsx", size: 0 })).toBe("빈 파일입니다.");
    expect(
      importFileError({ name: "a.xlsx", size: MAX_IMPORT_BYTES + 1 }),
    ).toContain("5MB");
  });
});
