import { describe, expect, it } from "vitest";

import { homePathFor } from "@/shared/auth/access";
import { DEV_USERS } from "@/shared/auth/dev-users";
import type { AppUser } from "@/shared/auth/types";

import { date } from "../metrics/test-fixtures";
import {
  aiAbilities,
  aiCardAccess,
  aiTargetQuarter,
  type QuarterPeriod,
} from "./rules";

const user = (id: string): AppUser => DEV_USERS.find((u) => u.id === id)!;
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
  const leader = user("dev-mgmt-leader");
  const member = user("dev-mgmt-member");

  it("끝난 분기 + 확정 데이터 + 팀장이면 분석 가능", () => {
    expect(aiAbilities(leader, q3, date("2026-10-01"), true)).toEqual({
      canGenerate: true,
      notice: null,
    });
    expect(
      aiAbilities(user("dev-ceo"), q3, date("2026-10-17"), true).canGenerate,
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
    for (const u of [member, user("dev-prod-member")]) {
      expect(aiAbilities(u, q3, date("2026-10-17"), true)).toEqual({
        canGenerate: false,
        notice: null,
      });
    }
  });
});

describe("역할 × 화면별 AI 카드 노출", () => {
  // 화면 접근: 메인(/)은 경영지원 열람 권한이 없으면 자기 팀 페이지로 이동, /management 는 403
  type Outcome = "카드+버튼" | "카드(열람)" | "이동:/production" | "403";
  const outcome = (u: AppUser, screen: "/" | "/management"): Outcome => {
    const access = aiCardAccess(u);
    if (access === "none") {
      return screen === "/" ? (`이동:${homePathFor(u)}` as Outcome) : "403";
    }
    return access === "generate" ? "카드+버튼" : "카드(열람)";
  };

  const table: [string, Outcome, Outcome][] = [
    // 역할, 메인(/), 경영지원 상세(/management)
    ["dev-admin", "카드+버튼", "카드+버튼"],
    ["dev-ceo", "카드+버튼", "카드+버튼"],
    ["dev-mgmt-leader", "카드+버튼", "카드+버튼"],
    ["dev-mgmt-member", "카드(열람)", "카드(열람)"],
    ["dev-prod-member", "이동:/production", "403"],
  ];

  it.each(table)("%s: / → %s, /management → %s", (id, main, detail) => {
    const u = user(id);
    expect(outcome(u, "/")).toBe(main);
    expect(outcome(u, "/management")).toBe(detail);
    // 버튼은 분기 조건(끝난 분기·확정 데이터)까지 만족할 때 — 화면과 무관하게 같은 판단
    expect(aiAbilities(u, q3, date("2026-10-20"), true).canGenerate).toBe(
      main === "카드+버튼",
    );
  });
});
