import { describe, expect, it, vi } from "vitest";

import { EDIT_ONLY_MGMT, FAKE_USERS } from "@/shared/auth/testing/fake-users";

import {
  caretAfterFormat,
  digitsOnly,
  digitsToBigInt,
  formatDigits,
} from "./money-input";
import {
  defaultEntryMonth,
  entryAbilities,
  isDigitAnomaly,
  monthState,
} from "./rules";

// 경영지원팀 = 확정까지 가능, EDIT_ONLY_MGMT = 입력만 가능(지금 규칙엔 없는 조합 — 화면 분기 검사용)
vi.mock("@/shared/auth/can", async (importOriginal) => {
  const { withEditOnlyUser } = await import("@/shared/auth/testing/fake-users");
  return withEditOnlyUser(await importOriginal());
});

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const today = d("2026-10-16");

describe("입력 가능한 달", () => {
  it("미래 / 이번 달 / 지난 달", () => {
    expect(monthState({ year: 2026, month: 11 }, today)).toBe("future");
    expect(monthState({ year: 2026, month: 10 }, today)).toBe("current");
    expect(monthState({ year: 2026, month: 9 }, today)).toBe("closed");
    expect(monthState({ year: 2025, month: 12 }, today)).toBe("closed");
  });

  it("기본값은 지난달 (1월이면 전년 12월)", () => {
    expect(defaultEntryMonth(today)).toEqual({ year: 2026, month: 9 });
    expect(defaultEntryMonth(d("2027-01-05"))).toEqual({
      year: 2026,
      month: 12,
    });
  });
});

describe("entryAbilities", () => {
  const leader = FAKE_USERS.mgmt;
  const member = EDIT_ONLY_MGMT;
  const prod = FAKE_USERS.prodMember;
  const admin = FAKE_USERS.admin;

  it("지난 달 임시저장 상태: 팀장은 저장·확정, 팀원은 저장만 + 확정 대기 안내", () => {
    expect(entryAbilities(leader, "DRAFT", "closed")).toMatchObject({
      canSaveDraft: true,
      canConfirm: true,
      readOnly: false,
      notice: null,
    });
    expect(entryAbilities(member, "DRAFT", "closed")).toMatchObject({
      canSaveDraft: true,
      canConfirm: false,
      readOnly: false,
      notice: "확정은 팀장이 합니다 — 팀장 확정 대기",
    });
  });

  it("확정된 달: 팀장은 수정·확정 취소, 팀원은 읽기 전용", () => {
    expect(entryAbilities(leader, "CONFIRMED", "closed")).toMatchObject({
      canEditConfirmed: true,
      canUnconfirm: true,
      canSaveDraft: false,
      readOnly: false,
    });
    expect(entryAbilities(member, "CONFIRMED", "closed")).toMatchObject({
      canEditConfirmed: false,
      canUnconfirm: false,
      readOnly: true,
      notice: "확정된 달은 팀장만 수정할 수 있습니다.",
    });
  });

  it("이번 달: 팀장도 임시저장만", () => {
    expect(entryAbilities(leader, "NEW", "current")).toMatchObject({
      canSaveDraft: true,
      canConfirm: false,
      notice:
        "이번 달은 임시저장만 할 수 있습니다. 월이 끝난 뒤 확정할 수 있습니다.",
    });
  });

  it("미래 달·권한 없음은 모두 불가", () => {
    expect(entryAbilities(admin, "NEW", "future")).toMatchObject({
      canSaveDraft: false,
      readOnly: true,
    });
    expect(entryAbilities(prod, "DRAFT", "closed")).toMatchObject({
      canSaveDraft: false,
      readOnly: true,
    });
  });
});

describe("isDigitAnomaly (전월 대비 10배 이상 / 1/10 이하)", () => {
  it("경계값", () => {
    expect(isDigitAnomaly(1_000n, 100n)).toBe(true);
    expect(isDigitAnomaly(999n, 100n)).toBe(false);
    expect(isDigitAnomaly(10n, 100n)).toBe(true);
    expect(isDigitAnomaly(11n, 100n)).toBe(false);
  });

  it("전월 값이 없거나 0원이면 경고 없음", () => {
    expect(isDigitAnomaly(1_000_000n, null)).toBe(false);
    expect(isDigitAnomaly(1_000_000n, 0n)).toBe(false);
  });
});

describe("금액 입력칸", () => {
  it("숫자만, 앞 0 제거, 15자리 제한", () => {
    expect(digitsOnly("1,234,567")).toBe("1234567");
    expect(digitsOnly("-12.5abc")).toBe("125");
    expect(digitsOnly("000120")).toBe("120");
    expect(digitsOnly("0")).toBe("0");
    expect(digitsOnly("")).toBe("");
    expect(digitsOnly("1234567890123456789")).toBe("123456789012345");
  });

  it("자동 콤마", () => {
    expect(formatDigits("1234567")).toBe("1,234,567");
    expect(formatDigits("999")).toBe("999");
    expect(formatDigits("")).toBe("");
  });

  it("콤마 재배치 후 커서 위치", () => {
    // "1,234" 에서 4 앞(숫자 3개 뒤)에 5 입력 → "12354" → "12,354", 커서는 5 뒤
    expect(caretAfterFormat("12,354", 4)).toBe(5);
    expect(caretAfterFormat("1,234,567", 7)).toBe(9);
    expect(caretAfterFormat("1,234", 0)).toBe(0);
  });

  it("빈칸은 0원", () => {
    expect(digitsToBigInt("")).toBe(0n);
    expect(digitsToBigInt("123")).toBe(123n);
  });
});
