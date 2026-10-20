// 로그인 세션 (DB 저장) — 쿠키에는 무작위 토큰, DB에는 그 SHA-256만 저장한다.
// proxy.ts 와 getCurrentUser() 가 같은 함수(findSessionUser)로 사용자를 찾는다.
import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/shared/db/client";
import type { AuthUser } from "@/shared/db/generated/client";

import { sessionExpiry } from "./login-rules";
import type { AppUser } from "./types";

export const SESSION_COOKIE = "newtork_session";

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

/** 세션 생성 → 쿠키에 넣을 토큰과 만료 시각 */
export async function createSession(userId: string, now: Date) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = sessionExpiry(now);
  await prisma.$transaction([
    // 만료된 세션 정리 (이 사용자 것만)
    prisma.authSession.deleteMany({
      where: { userId, expiresAt: { lte: now } },
    }),
    prisma.authSession.create({
      data: { id: hashToken(token), userId, expiresAt, createdAt: now },
    }),
  ]);
  return { token, expiresAt };
}

/** 토큰 → 활성 사용자 (만료·비활성·없는 세션은 null) */
export async function findSessionUser(
  token: string | undefined,
  now: Date,
): Promise<AppUser | null> {
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { id: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() <= now.getTime()) return null;
  if (session.user.deactivatedAt) return null;
  return toAppUser(session.user);
}

export async function deleteSession(token: string | undefined) {
  if (!token) return;
  await prisma.authSession.deleteMany({ where: { id: hashToken(token) } });
}

/** 이 사용자의 모든 세션 삭제 (비활성화·비밀번호 초기화 시 즉시 로그아웃), except = 남길 토큰 */
export async function deleteUserSessions(userId: string, except?: string) {
  await prisma.authSession.deleteMany({
    where: {
      userId,
      ...(except ? { id: { not: hashToken(except) } } : {}),
    },
  });
}

export function toAppUser(user: AuthUser): AppUser {
  return {
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    role: user.role,
    viewTeams: [...user.viewTeams],
    editTeams: [...user.editTeams],
    active: user.deactivatedAt === null,
    mustChangePassword: user.mustChangePassword,
  };
}
