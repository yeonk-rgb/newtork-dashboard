// 현재 사용자 — 로그인 세션(쿠키 토큰 → auth_session → auth_user)으로 찾는다.
// cacheComponents: cookies()를 읽으므로 호출하는 컴포넌트는 <Suspense> 안에 있어야 한다.
import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getNow } from "@/shared/time/now";

import { findSessionUser, SESSION_COOKIE } from "./session";
import type { AppUser } from "./types";

/** 로그인한 활성 사용자. 로그인 안 함·세션 만료·비활성 계정이면 null */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findSessionUser(token, await getNow());
});
