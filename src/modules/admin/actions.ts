"use server";
// 관리자 설정 Server Action — 모든 동작은 서버에서 canManageUsers()로 다시 확인한다
import { refresh } from "next/cache";

import {
  canManageUsers,
  deleteUserSessions,
  generateTempPassword,
  getCurrentUser,
  hashPassword,
  type AppUser,
} from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import { getNow } from "@/shared/time/now";

import {
  keepsAnAdmin,
  LAST_ADMIN_MESSAGE,
  normalizeScope,
  rowAbilities,
  scopeError,
} from "./rules";
import {
  createUserSchema,
  rowTargetSchema,
  saveChangesSchema,
  type CreateUserInput,
  type SaveChangesInput,
} from "./schemas";

export type AdminActionResult =
  | { ok: true; message: string; tempPassword?: string }
  | {
      ok: false;
      code: "FORBIDDEN" | "INVALID" | "CONFLICT" | "NOT_FOUND";
      message: string;
    };

const FORBIDDEN: AdminActionResult = {
  ok: false,
  code: "FORBIDDEN",
  message: "관리자만 할 수 있습니다.",
};
const CONFLICT: AdminActionResult = {
  ok: false,
  code: "CONFLICT",
  message: "다른 관리자가 먼저 수정했습니다. 새로고침 후 다시 시도하세요.",
};
const invalid = (message: string): AdminActionResult => ({
  ok: false,
  code: "INVALID",
  message,
});

/** 실패 시 트랜잭션을 되돌리면서 결과를 전달하기 위한 에러 */
class Abort extends Error {
  constructor(readonly result: AdminActionResult) {
    super(result.ok ? "" : result.message);
  }
}

async function requireAdmin(): Promise<AppUser | null> {
  const actor = await getCurrentUser();
  return actor && canManageUsers(actor) ? actor : null;
}

async function run(
  body: () => Promise<AdminActionResult>,
): Promise<AdminActionResult> {
  try {
    const result = await body();
    if (result.ok) refresh();
    return result;
  } catch (error) {
    if (error instanceof Abort) return error.result;
    throw error;
  }
}

/** 역할·열람 범위·수정 권한 일괄 저장 (하나라도 실패하면 전부 취소) */
export async function saveUserChanges(
  input: SaveChangesInput,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();
  if (!actor) return FORBIDDEN;
  const parsed = saveChangesSchema.safeParse(input);
  if (!parsed.success) return invalid("변경 내용을 확인하세요.");
  const changes = parsed.data.changes.map((c) => ({
    ...c,
    ...normalizeScope(c),
  }));

  for (const change of changes) {
    if (change.id === actor.id) return invalid("본인 권한은 바꿀 수 없습니다.");
    const error = scopeError(change);
    if (error) return invalid(error);
  }

  return run(() =>
    prisma.$transaction(
      async (tx) => {
        const rows = await tx.authUser.findMany({
          select: { id: true, role: true, deactivatedAt: true },
        });
        const byId = new Map(rows.map((r) => [r.id, r]));
        for (const change of changes) {
          const row = byId.get(change.id);
          if (!row) throw new Abort(CONFLICT);
          if (row.deactivatedAt) {
            throw new Abort(invalid("비활성 계정은 권한을 바꿀 수 없습니다."));
          }
        }
        const roles = new Map(changes.map((c) => [c.id, c.role]));
        const current = rows.map((r) => ({
          id: r.id,
          role: r.role,
          active: r.deactivatedAt === null,
        }));
        if (!keepsAnAdmin(current, { roles })) {
          throw new Abort(invalid(LAST_ADMIN_MESSAGE));
        }

        for (const change of changes) {
          const { count } = await tx.authUser.updateMany({
            where: {
              id: change.id,
              updatedAt: new Date(change.expectedUpdatedAt),
            },
            data: {
              role: change.role,
              viewTeams: change.viewTeams,
              editTeams: change.editTeams,
              updatedById: actor.id,
            },
          });
          if (count !== 1) throw new Abort(CONFLICT);
        }
        return {
          ok: true,
          message: `${changes.length}명의 권한을 변경했습니다.`,
        } as const;
      },
      { isolationLevel: "Serializable" },
    ),
  );
}

/** 비밀번호 초기화 → 임시 비밀번호를 한 번만 돌려준다 (DB에는 해시만) */
export async function resetUserPassword(input: {
  id: string;
}): Promise<AdminActionResult> {
  const actor = await requireAdmin();
  if (!actor) return FORBIDDEN;
  const parsed = rowTargetSchema.safeParse(input);
  if (!parsed.success) return invalid("대상을 확인하세요.");

  const row = await prisma.authUser.findUnique({
    where: { id: parsed.data.id },
  });
  if (!row)
    return { ok: false, code: "NOT_FOUND", message: "직원이 없습니다." };
  const ability = rowAbilities(actor, {
    id: row.id,
    role: row.role,
    active: row.deactivatedAt === null,
  });
  if (ability.isSelf) {
    return invalid("본인 비밀번호는 [비밀번호 변경]에서 바꾸세요.");
  }
  if (!ability.resetPassword) {
    return invalid("비활성 계정은 비밀번호를 초기화할 수 없습니다.");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  return run(async () => {
    await prisma.authUser.update({
      where: { id: row.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        updatedById: actor.id,
      },
    });
    await deleteUserSessions(row.id);
    return {
      ok: true,
      message: `${row.name}(${row.loginId})의 비밀번호를 초기화했습니다.`,
      tempPassword,
    };
  });
}

/** 계정 추가 → 임시 비밀번호를 한 번만 돌려준다 */
export async function createUser(
  input: CreateUserInput,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();
  if (!actor) return FORBIDDEN;
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message ?? "입력값을 확인하세요.");
  }
  const scope = normalizeScope(parsed.data);
  const error = scopeError(scope);
  if (error) return invalid(error);

  const exists = await prisma.authUser.findUnique({
    where: { loginId: parsed.data.loginId },
    select: { id: true },
  });
  if (exists) return invalid("이미 있는 아이디입니다.");

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  return run(async () => {
    await prisma.authUser.create({
      data: {
        loginId: parsed.data.loginId,
        name: parsed.data.name,
        ...scope,
        passwordHash,
        mustChangePassword: true,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    return {
      ok: true,
      message: `${parsed.data.name}(${parsed.data.loginId}) 계정을 추가했습니다.`,
      tempPassword,
    };
  });
}

/** 퇴사자 비활성화 (삭제 대신) — 로그인 중이면 즉시 로그아웃 */
export async function deactivateUser(input: {
  id: string;
}): Promise<AdminActionResult> {
  const actor = await requireAdmin();
  if (!actor) return FORBIDDEN;
  const parsed = rowTargetSchema.safeParse(input);
  if (!parsed.success) return invalid("대상을 확인하세요.");
  const id = parsed.data.id;
  if (id === actor.id) return invalid("본인 계정은 비활성화할 수 없습니다.");
  const now = await getNow();

  return run(() =>
    prisma.$transaction(
      async (tx) => {
        const rows = await tx.authUser.findMany({
          select: { id: true, role: true, deactivatedAt: true },
        });
        const row = rows.find((r) => r.id === id);
        if (!row)
          throw new Abort({
            ok: false,
            code: "NOT_FOUND",
            message: "직원이 없습니다.",
          });
        if (row.deactivatedAt)
          throw new Abort(invalid("이미 비활성 계정입니다."));
        const current = rows.map((r) => ({
          id: r.id,
          role: r.role,
          active: r.deactivatedAt === null,
        }));
        if (!keepsAnAdmin(current, { deactivate: id })) {
          throw new Abort(invalid(LAST_ADMIN_MESSAGE));
        }
        await tx.authUser.update({
          where: { id },
          data: {
            deactivatedAt: now,
            deactivatedById: actor.id,
            updatedById: actor.id,
          },
        });
        await tx.authSession.deleteMany({ where: { userId: id } });
        return { ok: true, message: "계정을 비활성화했습니다." } as const;
      },
      { isolationLevel: "Serializable" },
    ),
  );
}

/** 비활성 계정 복구 */
export async function restoreUser(input: {
  id: string;
}): Promise<AdminActionResult> {
  const actor = await requireAdmin();
  if (!actor) return FORBIDDEN;
  const parsed = rowTargetSchema.safeParse(input);
  if (!parsed.success) return invalid("대상을 확인하세요.");
  return run(async () => {
    const { count } = await prisma.authUser.updateMany({
      where: { id: parsed.data.id, deactivatedAt: { not: null } },
      data: {
        deactivatedAt: null,
        deactivatedById: null,
        updatedById: actor.id,
      },
    });
    if (count !== 1) return CONFLICT;
    return { ok: true, message: "계정을 복구했습니다." };
  });
}
