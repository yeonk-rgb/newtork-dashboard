// 현재 사용자 결정 규칙 (순수 함수 — 테스트용으로 분리). 실제 로그인으로 교체할 때 삭제한다.
import { DEFAULT_DEV_USER_ID, findDevUser } from "./dev-users";
import type { AppUser } from "./types";

export const DEV_USER_COOKIE = "dev-user-id";

type Env = {
  nodeEnv: string | undefined;
  demoMode: string | undefined;
};

/** 사용자 전환은 `next dev`에서만 */
export function isDevSwitchEnabled(env: Env): boolean {
  return env.nodeEnv === "development";
}

/** 배포 빌드는 기본 차단, DEMO_MODE=true 일 때만 시연용으로 허용 */
export function isDemoMode(env: Env): boolean {
  return env.nodeEnv === "production" && env.demoMode === "true";
}

/**
 * - 개발: 쿠키의 사용자, 없거나 모르는 id면 기본 사용자(경영지원 팀장)
 * - 배포 + DEMO_MODE=true: 경영지원 팀장 고정 (쿠키 무시)
 * - 그 외(배포 기본, 테스트 등): null → 접근 차단
 */
export function resolveCurrentUser(
  env: Env,
  cookieUserId: string | undefined,
): AppUser | null {
  if (isDevSwitchEnabled(env)) {
    return findDevUser(cookieUserId) ?? findDevUser(DEFAULT_DEV_USER_ID)!;
  }
  if (isDemoMode(env)) {
    return findDevUser(DEFAULT_DEV_USER_ID)!;
  }
  return null;
}
