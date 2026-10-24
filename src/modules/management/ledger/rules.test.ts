import { describe, expect, it, vi } from "vitest";

import { EDIT_ONLY_MGMT, FAKE_USERS } from "@/shared/auth/testing/fake-users";

import { parseKindParam } from "./labels";
import {
  canCreateLedgerEntry,
  canManageHiddenLedger,
  formatLedgerMonth,
  isFutureMonth,
  isPartnerCode,
  ledgerAbilities,
  ledgerDateErrors,
  monthOfDate,
  parseLedgerMonth,
} from "./rules";

// EDIT_ONLY_MGMT = 입력만 가능(지금 규칙엔 없는 조합 — 화면 분기 검사용)
vi.mock("@/shared/auth/can", async (importOriginal) => {
  const { withEditOnlyUser } = await import("@/shared/auth/testing/fake-users");
  return withEditOnlyUser(await importOriginal());
});

const TODAY = "2026-10-24";

describe("권한 (2026-10-24 결정: 관리자·경영지원팀 전원 수정)", () => {
  it("관리자·경영지원팀: 추가·수정·숨김·복구", () => {
    for (const user of [FAKE_USERS.admin, FAKE_USERS.mgmt]) {
      expect(canCreateLedgerEntry(user)).toBe(true);
      expect(canManageHiddenLedger(user)).toBe(true);
      expect(ledgerAbilities(user, { hidden: false })).toEqual({
        canEdit: true,
        canHide: true,
        canRestore: false,
        notice: null,
      });
      expect(ledgerAbilities(user, { hidden: true })).toMatchObject({
        canEdit: false,
        canHide: false,
        canRestore: true,
      });
    }
  });

  it("입력만 가능한 사용자: 수정은 되고 숨김·복구는 안 됨", () => {
    expect(ledgerAbilities(EDIT_ONLY_MGMT, { hidden: false })).toMatchObject({
      canEdit: true,
      canHide: false,
    });
    expect(ledgerAbilities(EDIT_ONLY_MGMT, { hidden: true }).canRestore).toBe(
      false,
    );
  });

  it("생산·서비스 팀장·팀원: 아무것도 못 함", () => {
    for (const user of [
      FAKE_USERS.prodLeader,
      FAKE_USERS.prodMember,
      FAKE_USERS.svcLeader,
    ]) {
      expect(canCreateLedgerEntry(user)).toBe(false);
      expect(canManageHiddenLedger(user)).toBe(false);
      expect(ledgerAbilities(user, { hidden: false }).canEdit).toBe(false);
    }
  });
});

describe("기준년월·탭", () => {
  it("parseLedgerMonth: 형식이 틀리면 null", () => {
    expect(parseLedgerMonth("2026-09")).toEqual({ year: 2026, month: 9 });
    for (const v of ["2026-9", "2026-13", "1999-01", "", undefined]) {
      expect(parseLedgerMonth(v)).toBeNull();
    }
  });

  it("formatLedgerMonth·monthOfDate·isFutureMonth", () => {
    expect(formatLedgerMonth({ year: 2026, month: 3 })).toBe("2026-03");
    expect(monthOfDate(TODAY)).toEqual({ year: 2026, month: 10 });
    expect(isFutureMonth({ year: 2026, month: 10 }, TODAY)).toBe(false);
    expect(isFutureMonth({ year: 2026, month: 11 }, TODAY)).toBe(true);
    expect(isFutureMonth({ year: 2025, month: 12 }, TODAY)).toBe(false);
  });

  it("parseKindParam: 모르는 값은 외상매출금", () => {
    expect(parseKindParam("vendor")).toBe("ACCRUED_VENDOR");
    expect(parseKindParam("xx")).toBe("AR");
    expect(parseKindParam(undefined)).toBe("AR");
  });
});

describe("거래처코드", () => {
  it("숫자 10자리만 (앞자리 0 포함)", () => {
    expect(isPartnerCode("0000000087")).toBe(true);
    for (const v of ["87", "000000087", "00000000870", "000000008a", ""]) {
      expect(isPartnerCode(v)).toBe(false);
    }
  });
});

describe("ledgerDateErrors", () => {
  const ar = (arStatus: "LONG_OVERDUE" | "COLLECTED" | "SCHEDULED") => ({
    kind: "AR" as const,
    arStatus,
    dueOn: null,
  });

  it("당월수금완료는 완료일 필수, 오늘 이후 불가", () => {
    expect(
      ledgerDateErrors({ ...ar("COLLECTED"), settledOn: null }, TODAY)
        .settledOn,
    ).toBe("수금 완료일을 입력하세요.");
    expect(
      ledgerDateErrors({ ...ar("COLLECTED"), settledOn: "2026-10-25" }, TODAY)
        .settledOn,
    ).toBe("완료일은 오늘 이후로 입력할 수 없습니다.");
    expect(
      ledgerDateErrors({ ...ar("COLLECTED"), settledOn: TODAY }, TODAY),
    ).toEqual({});
  });

  it("외상매출금 장기미수·예정에는 완료일을 넣을 수 없음", () => {
    for (const s of ["LONG_OVERDUE", "SCHEDULED"] as const) {
      expect(
        ledgerDateErrors({ ...ar(s), settledOn: "2026-10-01" }, TODAY)
          .settledOn,
      ).toBe("완료일은 당월수금완료일 때만 입력합니다.");
    }
  });

  it("채무 구분은 완료일 선택, 예정일은 형식만 확인", () => {
    const ap = { kind: "AP" as const, arStatus: null };
    expect(
      ledgerDateErrors({ ...ap, dueOn: "2027-01-31", settledOn: null }, TODAY),
    ).toEqual({});
    expect(
      ledgerDateErrors({ ...ap, dueOn: null, settledOn: "2026-10-01" }, TODAY),
    ).toEqual({});
    expect(
      ledgerDateErrors({ ...ap, dueOn: "2026-02-30", settledOn: null }, TODAY)
        .dueOn,
    ).toBe("예정일 형식이 올바르지 않습니다.");
  });
});
