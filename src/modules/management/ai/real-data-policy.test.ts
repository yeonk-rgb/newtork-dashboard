import { afterEach, describe, expect, it, vi } from "vitest";

import { FAKE_USERS } from "@/shared/auth/testing/fake-users";

import {
  isAiRealDataBlocked,
  isUploadedDataBlocked,
} from "./real-data-policy";
import {
  ADMIN_CONSENT_NOTICE,
  aiAbilities,
  REAL_DATA_BLOCKED_NOTICE,
  UPLOADED_DATA_NOTICE,
  type QuarterPeriod,
} from "./rules";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAiRealDataBlocked", () => {
  it("배포 빌드(production)는 AI_ALLOW_REAL_DATA=true 일 때만 허용", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_ALLOW_REAL_DATA", "");
    expect(isAiRealDataBlocked()).toBe(true);
    vi.stubEnv("AI_ALLOW_REAL_DATA", "false");
    expect(isAiRealDataBlocked()).toBe(true);
    vi.stubEnv("AI_ALLOW_REAL_DATA", "true");
    expect(isAiRealDataBlocked()).toBe(false);
  });

  it("개발·테스트(로컬 샘플 DB)는 막지 않음", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_ALLOW_REAL_DATA", "false");
    expect(isAiRealDataBlocked()).toBe(false);
  });
});

// AI_ALLOW_REAL_DATA 하나로 두 차단(배포 서버 실제 숫자 + 엑셀 업로드로 옮긴 달)을 같이 푼다 (2026-10-26 결정)
describe("AI_ALLOW_REAL_DATA 하나로 두 차단", () => {
  const q3: QuarterPeriod = { unit: "quarter", year: 2026, quarter: 3 };
  const today = new Date("2026-10-26T00:00:00Z");
  /** 화면·Server Action 과 같은 조합 */
  const abilities = (uploaded: boolean) =>
    aiAbilities(
      FAKE_USERS.mgmt,
      q3,
      today,
      true,
      isUploadedDataBlocked(uploaded),
      isAiRealDataBlocked(),
    );

  it("false(기본): 배포 서버는 둘 다 막힘 — 업로드 분기는 업로드 안내, 아니면 실제 숫자 안내", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_ALLOW_REAL_DATA", "false");
    expect(abilities(true)).toEqual({
      canGenerate: false,
      notice: UPLOADED_DATA_NOTICE,
    });
    expect(abilities(false)).toEqual({
      canGenerate: false,
      notice: REAL_DATA_BLOCKED_NOTICE,
    });
  });

  it("false: 개발 서버에서도 엑셀 업로드로 옮긴 달은 막힘 (샘플만 분석)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_ALLOW_REAL_DATA", "");
    expect(abilities(true).canGenerate).toBe(false);
    expect(abilities(false).canGenerate).toBe(true);
  });

  it("false 여도 관리자(대표)는 배포 서버·업로드 분기 모두 확인창을 거쳐 실행 (2026-10-28)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_ALLOW_REAL_DATA", "false");
    for (const uploaded of [true, false]) {
      expect(
        aiAbilities(
          FAKE_USERS.admin,
          q3,
          today,
          true,
          isUploadedDataBlocked(uploaded),
          isAiRealDataBlocked(),
        ),
      ).toEqual({
        canGenerate: true,
        notice: null,
        consentNotice: ADMIN_CONSENT_NOTICE,
      });
    }
  });

  it("true: 배포 서버에서 업로드 달이 들어간 분기도 분석 가능", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_ALLOW_REAL_DATA", "true");
    expect(abilities(true)).toEqual({ canGenerate: true, notice: null });
    expect(abilities(false)).toEqual({ canGenerate: true, notice: null });
  });
});
