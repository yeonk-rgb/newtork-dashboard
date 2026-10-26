"use server";
// 월간 입력 저장 Server Action — 권한·검증·동시 수정을 모두 서버에서 다시 확인한다
// 확정·확정 후 수정·확정 취소는 변경 기록(audit_log)을 같은 트랜잭션에 남긴다 (임시저장은 기록하지 않음 — 2026-10-25 결정)
import { refresh } from "next/cache";

import { recordAudit } from "@/shared/audit/record";
import { getCurrentUser } from "@/shared/auth";
import { prisma } from "@/shared/db/client";

import {
  auditActor,
  monthlyChanges,
  monthlyTargetLabel,
  type MonthlyAuditSnapshot,
} from "../audit-fields";
import { getNow, getTodayKst } from "../data/load-summary-input";
import type { ExpenseType, PurchaseType } from "../ledger/labels";
import { FROM_LEDGER_BLOCKS, type FromLedgerBlock } from "./from-ledger";
import { entryAbilities, monthState, type EntryStatus } from "./rules";
import {
  ledgerForEntrySchema,
  saveEntrySchema,
  unconfirmSchema,
} from "./schemas";

export type EntryActionResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code: "FORBIDDEN" | "INVALID" | "CONFLICT" | "NOT_FOUND";
      message: string;
    };

const CONFLICT_MESSAGE =
  "다른 사람이 먼저 저장했습니다. 새로고침 후 다시 입력하세요.";

class ConflictError extends Error {}

/** 저장 전 그 달 값 (변경 기록의 "바뀌기 전") */
function snapshotOf(
  existing: {
    status: "DRAFT" | "CONFIRMED";
    productSales: bigint;
    goodsSales: bigint;
    serviceSales: bigint;
    goodsPurchase: bigint;
    materialPurchase: bigint;
    operatingExpense: bigint;
    otherExpenses: { categoryId: string; amount: bigint }[];
  } | null,
): MonthlyAuditSnapshot | null {
  if (!existing) return null;
  return {
    values: {
      productSales: existing.productSales,
      goodsSales: existing.goodsSales,
      serviceSales: existing.serviceSales,
      goodsPurchase: existing.goodsPurchase,
      materialPurchase: existing.materialPurchase,
      operatingExpense: existing.operatingExpense,
    },
    status: existing.status,
    others: new Map(
      existing.otherExpenses.map((e) => [e.categoryId, e.amount]),
    ),
  };
}

function forbidden(message: string): EntryActionResult {
  return { ok: false, code: "FORBIDDEN", message };
}

export async function saveMonthlyEntry(
  raw: unknown,
): Promise<EntryActionResult> {
  const user = await getCurrentUser();
  if (!user) return forbidden("로그인이 필요합니다.");

  const parsed = saveEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요.",
    };
  }
  const input = parsed.data;
  const ym = { year: input.year, month: input.month };

  const existing = await prisma.monthlyFinance.findUnique({
    where: { year_month: ym },
    include: { otherExpenses: true },
  });
  const status: EntryStatus = existing ? existing.status : "NEW";
  const abilities = entryAbilities(
    user,
    status,
    monthState(ym, await getTodayKst()),
  );

  const allowed =
    (input.intent === "draft" && abilities.canSaveDraft) ||
    (input.intent === "confirm" && abilities.canConfirm) ||
    (input.intent === "update-confirmed" && abilities.canEditConfirmed);
  if (!allowed) {
    return forbidden(abilities.notice ?? "이 작업을 할 권한이 없습니다.");
  }

  // 동시 수정: 불러올 때의 updatedAt 과 지금이 다르면 거부
  const currentUpdatedAt = existing?.updatedAt.toISOString() ?? null;
  if (currentUpdatedAt !== input.expectedUpdatedAt) {
    return { ok: false, code: "CONFLICT", message: CONFLICT_MESSAGE };
  }

  // 그 외 지출 항목: 존재하는 항목만, 비활성 항목은 이 달에 이미 값이 있을 때만
  // (변경 기록의 항목 이름에도 쓰므로 이 달에 이미 있던 항목도 함께 읽는다)
  const categories = await prisma.expenseCategory.findMany({
    where: {
      id: {
        in: [
          ...input.otherExpenses.map((e) => e.categoryId),
          ...(existing?.otherExpenses.map((e) => e.categoryId) ?? []),
        ],
      },
    },
  });
  // 비활성 항목은 이 달에 0원이 아닌 값이 있을 때만 (화면에도 그 경우에만 보인다)
  const usedHere = new Set(
    existing?.otherExpenses
      .filter((e) => e.amount !== 0n)
      .map((e) => e.categoryId),
  );
  for (const e of input.otherExpenses) {
    const category = categories.find((c) => c.id === e.categoryId);
    if (!category || (!category.isActive && !usedHere.has(category.id))) {
      return {
        ok: false,
        code: "INVALID",
        message:
          "사용할 수 없는 지출 항목이 있습니다. 새로고침 후 다시 입력하세요.",
      };
    }
  }

  const now = await getNow();
  const nextStatus = input.intent === "draft" ? "DRAFT" : "CONFIRMED";
  const confirmedAt =
    input.intent === "confirm"
      ? now
      : input.intent === "update-confirmed"
        ? (existing?.confirmedAt ?? now)
        : null;

  try {
    await prisma.$transaction(async (tx) => {
      let financeId: string;
      if (existing) {
        // updatedAt 이 그대로일 때만 수정 (확인과 저장 사이에 끼어든 저장도 막음)
        const updated = await tx.monthlyFinance.updateMany({
          where: { id: existing.id, updatedAt: existing.updatedAt },
          data: {
            ...input.values,
            status: nextStatus,
            confirmedAt,
            updatedById: user.id,
          },
        });
        if (updated.count === 0) throw new ConflictError();
        financeId = existing.id;
      } else {
        const created = await tx.monthlyFinance.create({
          data: {
            ...ym,
            ...input.values,
            status: nextStatus,
            confirmedAt,
            createdById: user.id,
            updatedById: user.id,
          },
        });
        financeId = created.id;
      }
      for (const e of input.otherExpenses) {
        await tx.otherExpense.upsert({
          where: {
            monthlyFinanceId_categoryId: {
              monthlyFinanceId: financeId,
              categoryId: e.categoryId,
            },
          },
          update: { amount: e.amount },
          create: {
            monthlyFinanceId: financeId,
            categoryId: e.categoryId,
            amount: e.amount,
          },
        });
      }
      if (input.intent !== "draft") {
        await recordAudit(tx, {
          occurredAt: now,
          actor: auditActor(user),
          area: "management",
          screen: "entry",
          action: input.intent === "confirm" ? "CONFIRM" : "UPDATE_CONFIRMED",
          target: {
            type: "MonthlyFinance",
            id: financeId,
            label: monthlyTargetLabel(ym.year, ym.month),
          },
          changes: monthlyChanges(
            snapshotOf(existing),
            {
              values: input.values,
              status: "CONFIRMED",
              others: new Map(
                input.otherExpenses.map((e) => [e.categoryId, e.amount]),
              ),
            },
            new Map(categories.map((c) => [c.id, c.name])),
          ),
        });
      }
    });
  } catch (error) {
    // 새 달을 두 사람이 동시에 만들면 (연·월 유일) 위반 → 동시 수정으로 안내
    const code = (error as { code?: string }).code;
    if (error instanceof ConflictError || code === "P2002") {
      return { ok: false, code: "CONFLICT", message: CONFLICT_MESSAGE };
    }
    throw error;
  }

  refresh(); // 대시보드 등 화면이 새 값으로 다시 그려지도록
  const label = `${ym.year}년 ${ym.month}월`;
  return {
    ok: true,
    message:
      input.intent === "draft"
        ? `${label} 임시저장했습니다.`
        : input.intent === "confirm"
          ? `${label} 확정했습니다. 대시보드에 반영됩니다.`
          : `${label} 확정된 데이터를 수정했습니다.`,
  };
}

export async function unconfirmMonthlyEntry(
  raw: unknown,
): Promise<EntryActionResult> {
  const user = await getCurrentUser();
  if (!user) return forbidden("로그인이 필요합니다.");

  const parsed = unconfirmSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: "요청 값을 확인하세요." };
  }
  const ym = { year: parsed.data.year, month: parsed.data.month };

  const existing = await prisma.monthlyFinance.findUnique({
    where: { year_month: ym },
  });
  if (!existing || existing.status !== "CONFIRMED") {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "확정된 데이터가 없습니다.",
    };
  }
  const abilities = entryAbilities(
    user,
    "CONFIRMED",
    monthState(ym, await getTodayKst()),
  );
  if (!abilities.canUnconfirm)
    return forbidden("확정 취소는 팀장만 할 수 있습니다.");

  // 확정 취소와 변경 기록은 한 트랜잭션 (기록이 실패하면 취소도 되돌린다)
  const now = await getNow();
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.monthlyFinance.updateMany({
        where: {
          id: existing.id,
          updatedAt: new Date(parsed.data.expectedUpdatedAt),
        },
        data: { status: "DRAFT", confirmedAt: null, updatedById: user.id },
      });
      if (updated.count === 0) throw new ConflictError();
      await recordAudit(tx, {
        occurredAt: now,
        actor: auditActor(user),
        area: "management",
        screen: "entry",
        action: "UNCONFIRM",
        target: {
          type: "MonthlyFinance",
          id: existing.id,
          label: monthlyTargetLabel(ym.year, ym.month),
        },
        changes: [
          { field: "status", label: "상태", before: "확정", after: "임시저장" },
        ],
      });
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return { ok: false, code: "CONFLICT", message: CONFLICT_MESSAGE };
    }
    throw error;
  }

  refresh();
  return {
    ok: true,
    message: `${ym.year}년 ${ym.month}월 확정을 취소했습니다. 임시저장 상태로 바뀌었고 대시보드 집계에서 빠집니다.`,
  };
}

export type LedgerForEntryResult =
  | {
      ok: true;
      /** 금액은 정수 문자열 (BigInt 직렬화) */
      rows: {
        kind: FromLedgerBlock;
        amount: string;
        purchaseType: PurchaseType | null;
        expenseType: ExpenseType | null;
        autoTransfer: boolean;
      }[];
    }
  | { ok: false; code: "FORBIDDEN" | "INVALID"; message: string };

/**
 * [경영지원 관리에서 불러오기] — 그 달 외상매입금·미지급비용(직원·업체) 행 (숨긴 행 제외). 읽기만, 저장은 하지 않는다
 * 입력란을 고칠 수 있는 사람만 (화면과 같은 entryAbilities)
 */
export async function loadLedgerForEntry(
  raw: unknown,
): Promise<LedgerForEntryResult> {
  const user = await getCurrentUser();
  if (!user)
    return { ok: false, code: "FORBIDDEN", message: "로그인이 필요합니다." };
  const parsed = ledgerForEntrySchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, code: "INVALID", message: "기준년월을 확인하세요." };
  const ym = parsed.data;

  const existing = await prisma.monthlyFinance.findUnique({
    where: { year_month: ym },
    select: { status: true },
  });
  const abilities = entryAbilities(
    user,
    existing ? existing.status : "NEW",
    monthState(ym, await getTodayKst()),
  );
  if (abilities.readOnly) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: abilities.notice ?? "이 달을 입력할 권한이 없습니다.",
    };
  }

  const rows = await prisma.ledgerEntry.findMany({
    where: {
      year: ym.year,
      month: ym.month,
      kind: { in: FROM_LEDGER_BLOCKS },
      deletedAt: null,
    },
    select: {
      kind: true,
      amount: true,
      purchaseType: true,
      expenseType: true,
      autoTransfer: true,
    },
  });
  return {
    ok: true,
    rows: rows.map((r) => ({
      kind: r.kind as FromLedgerBlock,
      amount: r.amount.toString(),
      purchaseType: r.purchaseType,
      expenseType: r.expenseType,
      autoTransfer: r.autoTransfer,
    })),
  };
}
