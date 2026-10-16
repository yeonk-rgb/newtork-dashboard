"use server";
// 개발용 사용자 전환 Server Action — 실제 로그인으로 교체할 때 삭제한다.
import { cookies } from "next/headers";

import { findDevUser } from "./dev-users";
import { DEV_USER_COOKIE, isDevSwitchEnabled } from "./resolve-user";

export async function switchDevUser(userId: string): Promise<void> {
  // 화면에서 드롭다운을 숨기는 것과 별개로, 서버에서도 막는다
  if (
    !isDevSwitchEnabled({
      nodeEnv: process.env.NODE_ENV,
      demoMode: process.env.DEMO_MODE,
    })
  ) {
    throw new Error("사용자 전환은 개발 환경에서만 사용할 수 있습니다.");
  }
  if (!findDevUser(userId)) {
    throw new Error(`알 수 없는 사용자입니다: ${userId}`);
  }
  (await cookies()).set(DEV_USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
