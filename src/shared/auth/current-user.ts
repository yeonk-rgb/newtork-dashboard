// 현재 사용자 조회 — 실제 로그인으로 교체할 때 이 파일의 본문을 세션 조회로 바꾼다.
// cacheComponents: cookies()를 읽으므로 호출하는 컴포넌트는 <Suspense> 안에 있어야 한다.
import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import {
  DEV_USER_COOKIE,
  isDevSwitchEnabled,
  resolveCurrentUser,
} from "./resolve-user";
import type { AppUser } from "./types";

const env = () => ({
  nodeEnv: process.env.NODE_ENV,
  demoMode: process.env.DEMO_MODE,
});

/**
 * 현재 사용자. null이면 접근 차단(배포 빌드 + DEMO_MODE 아님).
 * 배포에서도 cookies()를 읽어 요청 시점에 판정한다 (빌드 시점 값으로 굳지 않게).
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const cookieUserId = (await cookies()).get(DEV_USER_COOKIE)?.value;
  return resolveCurrentUser(env(), cookieUserId);
});

/** 지금 실행 환경에서 사용자 전환 드롭다운을 보여줄지 */
export function isDevSwitchEnabledNow(): boolean {
  return isDevSwitchEnabled(env());
}
