"use server";
// 목표·항목 설정 저장 Server Action — confirm 권한만, 서버에서 다시 확인
// 저장과 변경 기록(audit_log)은 한 트랜잭션: 기록이 실패하면 저장도 취소된다
import { refresh } from "next/cache";

import { diffFields } from "@/shared/audit/diff";
import { recordAudit } from "@/shared/audit/record";
import { can, getCurrentUser, type AppUser } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import { getNow } from "@/shared/time/now";

import {
  auditActor,
  CATEGORY_AUDIT_FIELDS,
  TARGET_AUDIT_FIELDS,
  targetLabel,
  type CategoryAuditRow,
  type TargetAuditRow,
} from "../audit-fields";

import { categoriesVersion } from "./load-settings";
import {
  categoryNameErrors,
  saveCategoriesSchema,
  saveTargetSchema,
} from "./schemas";

export type SettingsActionResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code: "FORBIDDEN" | "INVALID" | "CONFLICT";
      message: string;
    };

const CONFLICT_MESSAGE =
  "다른 사람이 먼저 저장했습니다. 새로고침 후 다시 입력하세요.";

class ConflictError extends Error {}
class InvalidError extends Error {}

async function requireConfirm(): Promise<AppUser | SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user, "confirm", "management")) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "목표·항목 설정은 팀장만 할 수 있습니다.",
    };
  }
  return user;
}

export async function saveAnnualTarget(
  raw: unknown,
): Promise<SettingsActionResult> {
  const user = await requireConfirm();
  if ("ok" in user) return user;

  const parsed = saveTargetSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요.",
    };
  }
  const { year, revenueTarget, quarters, headcount, expectedUpdatedAt } =
    parsed.data;
  const data = {
    revenueTarget,
    q1Target: quarters[0],
    q2Target: quarters[1],
    q3Target: quarters[2],
    q4Target: quarters[3],
    headcount,
    updatedById: user.id,
  };

  const existing = await prisma.annualTarget.findUnique({ where: { year } });
  if ((existing?.updatedAt.toISOString() ?? null) !== expectedUpdatedAt) {
    return { ok: false, code: "CONFLICT", message: CONFLICT_MESSAGE };
  }

  const now = await getNow();
  try {
    await prisma.$transaction(async (tx) => {
      let id: string;
      if (existing) {
        const updated = await tx.annualTarget.updateMany({
          where: { id: existing.id, updatedAt: existing.updatedAt },
          data,
        });
        if (updated.count === 0) throw new ConflictError();
        id = existing.id;
      } else {
        const created = await tx.annualTarget.create({
          data: { year, ...data, createdById: user.id },
        });
        id = created.id;
      }
      await recordAudit(tx, {
        occurredAt: now,
        actor: auditActor(user),
        area: "management",
        screen: "targets",
        action: existing ? "UPDATE" : "CREATE",
        target: { type: "AnnualTarget", id, label: targetLabel(year) },
        changes: diffFields<TargetAuditRow>(
          existing,
          data,
          TARGET_AUDIT_FIELDS,
        ),
      });
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (error instanceof ConflictError || code === "P2002") {
      return { ok: false, code: "CONFLICT", message: CONFLICT_MESSAGE };
    }
    throw error;
  }

  refresh(); // 메인 연간 도넛·KPI 달성률에 바로 반영
  return {
    ok: true,
    message: `${year}년 목표를 저장했습니다. 대시보드에 반영됩니다.`,
  };
}

export async function saveExpenseCategories(
  raw: unknown,
): Promise<SettingsActionResult> {
  const user = await requireConfirm();
  if ("ok" in user) return user;

  const parsed = saveCategoriesSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요.",
    };
  }
  const { items, deletedIds, version } = parsed.data;
  if (categoryNameErrors(items.map((i) => i.name)).size > 0) {
    return {
      ok: false,
      code: "INVALID",
      message: "항목 이름이 비었거나 중복됩니다.",
    };
  }

  const now = await getNow();
  const audit = {
    occurredAt: now,
    actor: auditActor(user),
    area: "management" as const,
    screen: "expense-categories",
  };
  try {
    await prisma.$transaction(async (tx) => {
      // 동시 수정 확인 (트랜잭션 안에서 다시 읽음)
      const current = await tx.expenseCategory.findMany();
      if (categoriesVersion(current) !== version) throw new ConflictError();

      const known = new Set(current.map((c) => c.id));
      const keptIds = items.flatMap((i) => (i.id ? [i.id] : []));
      if ([...keptIds, ...deletedIds].some((id) => !known.has(id))) {
        throw new ConflictError();
      }
      // 화면에 없는데 삭제 목록에도 없는 항목 = 그 사이 다른 사람이 추가한 항목
      const listed = new Set([...keptIds, ...deletedIds]);
      if (current.some((c) => !listed.has(c.id))) throw new ConflictError();

      // 삭제: 0원이 아닌 금액이 한 번도 없는 항목만 (0원 행은 함께 지운다)
      for (const id of deletedIds) {
        const used = await tx.otherExpense.count({
          where: { categoryId: id, amount: { not: 0n } },
        });
        if (used > 0)
          throw new InvalidError(
            "사용 중인 항목은 삭제할 수 없습니다. 비활성화하세요.",
          );
        await tx.otherExpense.deleteMany({ where: { categoryId: id } });
        await tx.expenseCategory.delete({ where: { id } });
        const before = current.find((c) => c.id === id)!;
        await recordAudit(tx, {
          ...audit,
          action: "DELETE",
          target: { type: "ExpenseCategory", id, label: before.name },
          changes: diffFields<CategoryAuditRow>(
            before,
            null,
            CATEGORY_AUDIT_FIELDS,
          ),
        });
      }

      // 이름 맞바꾸기(A↔B) 중 유일 제약에 걸리지 않도록 기존 항목은 먼저 임시 이름으로
      for (const item of items) {
        if (item.id) {
          await tx.expenseCategory.update({
            where: { id: item.id },
            data: { name: `__renaming__${item.id}` },
          });
        }
      }
      for (const [index, item] of items.entries()) {
        const data = {
          name: item.name,
          costType: item.costType,
          isActive: item.isActive,
          sortOrder: index + 1,
        };
        if (item.id) {
          await tx.expenseCategory.update({ where: { id: item.id }, data });
          const before = current.find((c) => c.id === item.id)!;
          // 바뀐 칸이 없으면 recordAudit 가 기록하지 않는다 (순서만 바뀐 경우 포함)
          await recordAudit(tx, {
            ...audit,
            action: "UPDATE",
            target: { type: "ExpenseCategory", id: item.id, label: item.name },
            changes: diffFields<CategoryAuditRow>(
              before,
              data,
              CATEGORY_AUDIT_FIELDS,
            ),
          });
        } else {
          const created = await tx.expenseCategory.create({ data });
          await recordAudit(tx, {
            ...audit,
            action: "CREATE",
            target: {
              type: "ExpenseCategory",
              id: created.id,
              label: item.name,
            },
            changes: diffFields<CategoryAuditRow>(
              null,
              data,
              CATEGORY_AUDIT_FIELDS,
            ),
          });
        }
      }

      // 순서 변경은 항목마다가 아니라 한 건으로 — 남아 있는 항목끼리 순서가 바뀌었을 때만
      const nameOf = new Map(
        items.flatMap((i) => (i.id ? [[i.id, i.name]] : [])),
      );
      const keptBefore = [...current]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((c) => nameOf.has(c.id))
        .map((c) => nameOf.get(c.id)!);
      const keptAfter = items.flatMap((i) => (i.id ? [i.name] : []));
      if (keptBefore.join("\n") !== keptAfter.join("\n")) {
        await recordAudit(tx, {
          ...audit,
          action: "UPDATE",
          target: {
            type: "ExpenseCategoryOrder",
            id: "all",
            label: "그 외 지출 항목 순서",
          },
          changes: [
            {
              field: "order",
              label: "순서",
              before: keptBefore.join(", "),
              after: keptAfter.join(", "),
            },
          ],
        });
      }
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return { ok: false, code: "CONFLICT", message: CONFLICT_MESSAGE };
    }
    if (error instanceof InvalidError) {
      return { ok: false, code: "INVALID", message: error.message };
    }
    if ((error as { code?: string }).code === "P2002") {
      return {
        ok: false,
        code: "INVALID",
        message: "같은 이름의 항목이 이미 있습니다.",
      };
    }
    throw error;
  }

  refresh();
  return {
    ok: true,
    message: "그 외 지출 항목을 저장했습니다. 월간 입력 화면에 반영됩니다.",
  };
}
