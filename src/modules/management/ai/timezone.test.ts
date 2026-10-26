// 시간대 경계: 저장은 UTC, 날짜 계산은 getTodayKst()의 "한국 날짜(UTC 자정)", 표시는 Asia/Seoul
// 한국 시간 1월 1일 00:30 = UTC 12월 31일 15:30 — UTC 기준으로 계산하면 하루·한 분기가 어긋나는 지점
import { describe, expect, it, vi } from "vitest";

import { lastCompletedQuarter } from "@/shared/period/url";

import { monthState } from "../entry/rules";
import { computeItemReceivables } from "../metrics/receivables";
import { receivable } from "../metrics/test-fixtures";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/shared/db/client", () => ({ prisma: {} }));
vi.mock("@/shared/auth", () => ({ userDisplayName: (id: string) => id }));

const { todayKst } = await import("../data/load-summary-input");
const { dateTimeLabel } = await import("./load-comment");
const { aiAbilities } = await import("./rules");
const { FAKE_USERS } = await import("@/shared/auth/testing/fake-users");

// 경영지원팀 = 확정(confirm) 권한 — 인증 시리즈에서 개발용 DEV_USERS 가 테스트용 FAKE_USERS 로 바뀜
const leader = FAKE_USERS.mgmt;
const q4: { unit: "quarter"; year: number; quarter: 4 } = {
  unit: "quarter",
  year: 2026,
  quarter: 4,
};

/** 한국 시간 2027-01-01 00:30 / 2026-12-31 23:59 */
const KST_NEWYEAR_0030 = new Date("2026-12-31T15:30:00Z");
const KST_NEWYEAR_EVE_2359 = new Date("2026-12-31T14:59:00Z");

describe("자정 전후 (한국 시간 1월 1일 00:30)", () => {
  it("오늘 날짜는 한국 날짜", () => {
    expect(todayKst(KST_NEWYEAR_0030).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
    expect(todayKst(KST_NEWYEAR_EVE_2359).toISOString()).toBe(
      "2026-12-31T00:00:00.000Z",
    );
  });

  it("기본 기간(이미 끝난 분기 중 가장 최근)이 자정에 바뀐다", () => {
    expect(lastCompletedQuarter(todayKst(KST_NEWYEAR_EVE_2359))).toEqual({
      unit: "quarter",
      year: 2026,
      quarter: 3,
    });
    expect(lastCompletedQuarter(todayKst(KST_NEWYEAR_0030))).toEqual({
      unit: "quarter",
      year: 2026,
      quarter: 4,
    });
  });

  it("4분기 AI 분석은 한국 시간 1월 1일 0시부터 가능", () => {
    expect(
      aiAbilities(leader, q4, todayKst(KST_NEWYEAR_EVE_2359), true),
    ).toEqual({
      canGenerate: false,
      notice: "분기가 끝난 뒤(1월 1일부터) 분석할 수 있습니다.",
    });
    expect(
      aiAbilities(leader, q4, todayKst(KST_NEWYEAR_0030), true).canGenerate,
    ).toBe(true);
  });

  it("12월 입력: 12/31 23:59 까지는 이번 달(임시저장만), 1/1 00:30 부터 지난달(확정 가능)", () => {
    const dec = { year: 2026, month: 12 };
    expect(monthState(dec, todayKst(KST_NEWYEAR_EVE_2359))).toBe("current");
    expect(monthState(dec, todayKst(KST_NEWYEAR_0030))).toBe("closed");
  });

  it("90일 초과 미수금 경계도 한국 날짜 기준", () => {
    // 10/2 발생 → 12/31 은 90일(61~90), 1/1 은 91일(90일 초과)
    const r = [
      receivable("r", { occurredOn: new Date("2026-10-02T00:00:00Z") }),
    ];
    const bucketOn = (now: Date) =>
      computeItemReceivables(r, todayKst(now), 6).aging.find((a) => a.count > 0)
        ?.bucket;
    expect(bucketOn(KST_NEWYEAR_EVE_2359)).toBe("61-90");
    expect(bucketOn(KST_NEWYEAR_0030)).toBe("90+");
  });

  it("생성 시각 표시: UTC 로 저장된 값을 한국 시간으로 (실행 환경 시간대와 무관)", () => {
    expect(dateTimeLabel(KST_NEWYEAR_0030)).toBe("2027-01-01 00:30:00");
    expect(dateTimeLabel(new Date("2026-10-19T05:13:35Z"))).toBe(
      "2026-10-19 14:13:35",
    );
  });
});

describe("분기 경계", () => {
  it("분기 마지막 날(한국 9/30 23:59)엔 3분기 진행 중, 10/1 00:00 부터 끝난 분기", () => {
    const q3 = { unit: "quarter", year: 2026, quarter: 3 } as const;
    const sep30_2359 = todayKst(new Date("2026-09-30T14:59:00Z"));
    const oct1_0000 = todayKst(new Date("2026-09-30T15:00:00Z"));
    expect(aiAbilities(leader, q3, sep30_2359, true).canGenerate).toBe(false);
    expect(aiAbilities(leader, q3, oct1_0000, true).canGenerate).toBe(true);
    expect(lastCompletedQuarter(oct1_0000)).toEqual(q3);
  });
});
