import { describe, expect, it, vi } from "vitest";

import { homePathFor } from "@/shared/auth/access";
import { EDIT_ONLY_MGMT, FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";

import { date } from "../metrics/test-fixtures";
import {
  aiAbilities,
  aiCardAccess,
  aiTargetQuarter,
  type QuarterPeriod,
} from "./rules";

// 경영지원팀 = 확정까지 가능, EDIT_ONLY_MGMT = 입력만 가능(지금 규칙엔 없는 조합 — 화면 분기 검사용)
vi.mock("@/shared/auth/can", async (importOriginal) => {
  const { withEditOnlyUser } = await import("@/shared/auth/testing/fake-users");
  return withEditOnlyUser(await importOriginal());
});

const q3: QuarterPeriod = { unit: "quarter", year: 2026, quarter: 3 };
const ym = (month: number) => ({ year: 2026, month });

describe("aiTargetQuarter", () => {
  it("분기 보기는 그 분기, 월 보기는 그 달의 분기", () => {
    expect(aiTargetQuarter(q3, [])).toBe(q3);
    expect(
      aiTargetQuarter({ unit: "month", year: 2026, month: 8 }, []),
    ).toEqual(q3);
    expect(
      aiTargetQuarter({ unit: "month", year: 2026, month: 10 }, []),
    ).toEqual({ unit: "quarter", year: 2026, quarter: 4 });
  });

  it("연간·누적은 확정 월이 있는 마지막 분기", () => {
    expect(
      aiTargetQuarter({ unit: "year", year: 2026 }, [ym(1), ym(7), ym(8)]),
    ).toEqual(q3);
    expect(
      aiTargetQuarter({ unit: "ytd", year: 2026, month: 5 }, [ym(1), ym(4)]),
    ).toEqual({ unit: "quarter", year: 2026, quarter: 2 });
    expect(aiTargetQuarter({ unit: "year", year: 2026 }, [])).toBeNull();
  });
});

describe("aiAbilities", () => {
  const leader = FAKE_USERS.mgmt;
  const member = EDIT_ONLY_MGMT;

  it("끝난 분기 + 확정 데이터 + 팀장이면 분석 가능", () => {
    expect(aiAbilities(leader, q3, date("2026-10-01"), true)).toEqual({
      canGenerate: true,
      notice: null,
    });
    expect(
      aiAbilities(FAKE_USERS.admin, q3, date("2026-10-17"), true).canGenerate,
    ).toBe(true);
  });

  it("진행 중인 분기(마지막 날 포함)는 불가 + 가능 날짜 안내", () => {
    expect(aiAbilities(leader, q3, date("2026-09-30"), true)).toEqual({
      canGenerate: false,
      notice: "분기가 끝난 뒤(10월 1일부터) 분석할 수 있습니다.",
    });
    const q4: QuarterPeriod = { unit: "quarter", year: 2026, quarter: 4 };
    expect(aiAbilities(leader, q4, date("2026-10-17"), true).notice).toBe(
      "분기가 끝난 뒤(1월 1일부터) 분석할 수 있습니다.",
    );
  });

  it("확정 월이 없으면 불가", () => {
    expect(aiAbilities(leader, q3, date("2026-10-17"), false)).toEqual({
      canGenerate: false,
      notice: "이 분기에 확정된 달이 없어 분석할 수 없습니다.",
    });
  });

  it("팀원·생산 팀원은 버튼 없음 (안내 없이 결과만 열람)", () => {
    for (const u of [member, FAKE_USERS.prodMember]) {
      expect(aiAbilities(u, q3, date("2026-10-17"), true)).toEqual({
        canGenerate: false,
        notice: null,
      });
    }
  });
});

describe("역할 × 화면별 AI 카드 노출", () => {
  // 화면 접근: 메인(/)은 경영지원 열람 권한이 없으면 자기 팀 페이지로 이동, /management 는 403
  type Outcome =
    "카드+버튼" | "카드(열람)" | `이동:/${"production" | "service"}` | "403";
  const outcome = (u: AppUser, screen: "/" | "/management"): Outcome => {
    const access = aiCardAccess(u);
    if (access === "none") {
      return screen === "/" ? (`이동:${homePathFor(u)}` as Outcome) : "403";
    }
    return access === "generate" ? "카드+버튼" : "카드(열람)";
  };

  const table: [string, AppUser, Outcome, Outcome][] = [
    // 사용자, 메인(/), 경영지원 상세(/management)
    ["관리자", FAKE_USERS.admin, "카드+버튼", "카드+버튼"],
    ["경영지원팀", FAKE_USERS.mgmt, "카드+버튼", "카드+버튼"],
    ["입력 전용(가정)", EDIT_ONLY_MGMT, "카드(열람)", "카드(열람)"],
    ["생산 팀원", FAKE_USERS.prodMember, "이동:/production", "403"],
    ["서비스 팀장", FAKE_USERS.svcLeader, "이동:/service", "403"],
  ];

  it.each(table)("%s: / → %s, /management → %s", (_, u, main, detail) => {
    expect(outcome(u, "/")).toBe(main);
    expect(outcome(u, "/management")).toBe(detail);
    // 버튼은 분기 조건(끝난 분기·확정 데이터)까지 만족할 때 — 화면과 무관하게 같은 판단
    expect(aiAbilities(u, q3, date("2026-10-20"), true).canGenerate).toBe(
      main === "카드+버튼",
    );
  });
});
