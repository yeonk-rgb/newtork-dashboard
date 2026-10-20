"use server";
// 로그인·로그아웃·비밀번호 변경 Server Action
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/shared/db/client";
import { getNow } from "@/shared/time/now";

import { homePathFor } from "./access";
import { getCurrentUser } from "./current-user";
import {
  afterFailedLogin,
  isLocked,
  LOGIN_FAILED_MESSAGE,
  lockedMessage,
  newPasswordError,
  safeNextPath,
} from "./login-rules";
import { hashPassword, verifyPassword } from "./password";
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  SESSION_COOKIE,
  sessionCookieOptions,
  toAppUser,
} from "./session";

export type AuthFormState = { error: string | null };

const loginSchema = z.object({
  loginId: z.string().trim().toLowerCase().min(1).max(50),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

/** 없는 아이디도 같은 시간이 걸리게 (아이디 존재 여부 추측 방지) */
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("dummy-password-0"));

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    loginId: formData.get("loginId"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "아이디와 비밀번호를 입력하세요." };
  const { loginId, password, next } = parsed.data;
  const now = await getNow();

  const user = await prisma.authUser.findUnique({ where: { loginId } });
  if (!user) {
    await verifyPassword(password, await getDummyHash());
    return { error: LOGIN_FAILED_MESSAGE };
  }
  if (isLocked(user.lockedUntil, now)) {
    return { error: lockedMessage(user.lockedUntil!, now) };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok || user.deactivatedAt) {
    // 비활성 계정도 같은 안내 (계정 상태를 알려주지 않는다)
    if (!user.deactivatedAt) {
      const failed = afterFailedLogin(user, now);
      await prisma.authUser.update({ where: { id: user.id }, data: failed });
      if (failed.lockedUntil) {
        return { error: lockedMessage(failed.lockedUntil, now) };
      }
    }
    return { error: LOGIN_FAILED_MESSAGE };
  }

  await prisma.authUser.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
  });
  const { token, expiresAt } = await createSession(user.id, now);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));

  const target = safeNextPath(next);
  if (user.mustChangePassword) {
    redirect(
      target
        ? `/account/password?next=${encodeURIComponent(target)}`
        : "/account/password",
    );
  }
  redirect(target ?? homePathFor(toAppUser(user)));
}

export async function logout(): Promise<void> {
  const store = await cookies();
  await deleteSession(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

const changeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().max(200),
  confirmPassword: z.string().max(200),
  next: z.string().optional(),
});

export async function changePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = changeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "모든 칸을 입력하세요." };
  const { currentPassword, newPassword, confirmPassword, next } = parsed.data;

  if (newPassword !== confirmPassword) {
    return { error: "새 비밀번호 확인이 일치하지 않습니다." };
  }
  const policyError = newPasswordError({
    password: newPassword,
    loginId: user.loginId,
    currentPassword,
  });
  if (policyError) return { error: policyError };

  const row = await prisma.authUser.findUnique({ where: { id: user.id } });
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
    return { error: "현재 비밀번호가 올바르지 않습니다." };
  }

  const now = await getNow();
  await prisma.authUser.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      passwordChangedAt: now,
      updatedById: user.id,
    },
  });
  // 다른 기기의 로그인은 끊고 지금 세션만 유지
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await deleteUserSessions(user.id, token);

  redirect(
    safeNextPath(next) ?? homePathFor({ ...user, mustChangePassword: false }),
  );
}
