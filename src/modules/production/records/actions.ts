"use server";
// 제조내역 수정·숨김·복구 + 수주번호별 사업구분 지정 (생산 열람 권한이면 모두 가능 — 생산팀 규칙)
// 저장과 변경 이력은 한 트랜잭션 (기록 실패 시 저장도 취소), updatedAt 으로 동시 수정 확인
import { refresh } from "next/cache";

import {
  date,
  diffFields,
  labelOf,
  text,
  type AuditField,
} from "@/shared/audit/diff";
import { recordAudit } from "@/shared/audit/record";
import { getCurrentUser, type AppUser } from "@/shared/auth";
import { INDUSTRIES } from "@/shared/contracts/production";
import { prisma } from "@/shared/db/client";
import type { Prisma, ProdIndustry } from "@/shared/db/generated/client";
import { getNow } from "@/shared/time/now";

import { INDUSTRY_LABEL, UNCLASSIFIED_LABEL } from "../labels";
import { NO_EDIT_MESSAGE, productionAbilities } from "../rules";
import { COLUMNS, DATE_FIELDS } from "../upload/columns";
import type { ParseWarning } from "../upload/parse-sheet";
import { EDITABLE_FIELDS, recordEditSchema } from "./schemas";

export type ActionResult = { ok: boolean; message: string };

class ConflictError extends Error {}
const CONFLICT = "다른 사람이 먼저 수정했습니다. 새로고침 후 다시 시도하세요.";

type AuditRow = Record<string, unknown>;

/** 기록할 칸 — 화면 이름 그대로, 날짜는 "YYYY-MM-DD" */
const RECORD_AUDIT_FIELDS: AuditField<AuditRow>[] = [
  ...COLUMNS.filter((c) => c.field !== "serialNo").map((c) => ({
    key: c.field,
    label: c.label,
    format: c.kind === "date" ? date : text,
  })),
  { key: "quantity", label: "수량" },
];

const actor = (user: AppUser) => ({ id: user.id, loginId: user.loginId });
const recordLabel = (r: { sheetName: string; serialNo: string }) =>
  `${r.sheetName} · ${r.serialNo}`;

async function editor() {
  const user = await getCurrentUser();
  return user && productionAbilities(user).canEdit ? user : null;
}

/** 사업구분 지정·해제 (트랜잭션 안) — 바뀌었을 때만 기록 */
async function applyCategory(
  tx: Prisma.TransactionClient,
  user: AppUser,
  now: Date,
  orderNo: string,
  category: string,
) {
  const before = await tx.prodOrderCategory.findUnique({ where: { orderNo } });
  if ((before?.category ?? "") === category) return;
  if (category) {
    await tx.prodOrderCategory.upsert({
      where: { orderNo },
      create: {
        orderNo,
        category: category as ProdIndustry,
        updatedById: user.id,
      },
      update: { category: category as ProdIndustry, updatedById: user.id },
    });
  } else {
    await tx.prodOrderCategory.delete({ where: { orderNo } });
  }
  await recordAudit(tx, {
    occurredAt: now,
    actor: actor(user),
    area: "production",
    screen: "production-categories",
    action: "UPDATE",
    target: {
      type: "ProdOrderCategory",
      id: orderNo,
      label: `수주번호 ${orderNo}`,
    },
    changes: diffFields(
      { category: before?.category ?? null },
      { category: category || null },
      [
        {
          key: "category",
          label: "사업구분",
          format: (v) => labelOf(INDUSTRY_LABEL)(v) ?? UNCLASSIFIED_LABEL,
        },
      ],
    ),
  });
}

export async function updateRecord(raw: unknown): Promise<ActionResult> {
  const user = await editor();
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const parsed = recordEditSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요.",
    };
  }
  const input = parsed.data;
  const data: Record<string, string | Date | number | null> = {};
  for (const f of EDITABLE_FIELDS) {
    data[f] = DATE_FIELDS.has(f)
      ? input[f]
        ? new Date(`${input[f]}T00:00:00Z`)
        : null
      : input[f];
  }
  data.quantity = input.quantity === "" ? null : Number(input.quantity);

  const now = await getNow();
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.prodRecord.findUnique({
        where: { id: input.id },
      });
      if (!before || before.deletedAt) throw new ConflictError();
      const changes = diffFields<AuditRow>(before, data, RECORD_AUDIT_FIELDS);
      // 사람이 고친 칸의 변환 경고는 더 이상 맞지 않으므로 지운다 (친구 저장소와 같음)
      const edited = new Set(changes.map((c) => c.field));
      const warnings = (before.importWarnings as ParseWarning[]).filter(
        (w) => !edited.has(w.field),
      );
      const updated = await tx.prodRecord.updateMany({
        where: { id: input.id, updatedAt: new Date(input.updatedAt) },
        data: {
          ...data,
          importWarnings: warnings as unknown as Prisma.InputJsonValue,
          updatedById: user.id,
        },
      });
      if (updated.count === 0) throw new ConflictError();
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "production",
        screen: "production-records",
        action: "UPDATE",
        target: {
          type: "ProdRecord",
          id: before.id,
          label: recordLabel(before),
        },
        changes,
      });
      const orderNo = String(data.orderNo ?? "");
      if (orderNo) await applyCategory(tx, user, now, orderNo, input.category);
    });
  } catch (error) {
    if (error instanceof ConflictError) return { ok: false, message: CONFLICT };
    throw error;
  }
  refresh();
  return { ok: true, message: "저장했습니다." };
}

async function setHidden(id: string, hide: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !productionAbilities(user).canHide) {
    return { ok: false, message: NO_EDIT_MESSAGE };
  }
  const now = await getNow();
  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.prodRecord.findUnique({ where: { id } });
      if (!row || (row.deletedAt !== null) === hide) throw new ConflictError();
      await tx.prodRecord.update({
        where: { id },
        data: hide
          ? { deletedAt: now, deletedById: user.id }
          : { deletedAt: null, deletedById: null },
      });
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "production",
        screen: "production-records",
        action: hide ? "HIDE" : "RESTORE",
        target: { type: "ProdRecord", id, label: recordLabel(row) },
      });
    });
  } catch (error) {
    if (error instanceof ConflictError) return { ok: false, message: CONFLICT };
    throw error;
  }
  refresh();
  return { ok: true, message: hide ? "숨겼습니다." : "복구했습니다." };
}

export async function hideRecord(id: string) {
  return setHidden(String(id), true);
}

export async function restoreRecord(id: string) {
  return setHidden(String(id), false);
}

/** 사업구분 지정 화면 — 제조내역에 있는 수주번호만 */
export async function setOrderCategory(
  orderNo: string,
  category: string,
): Promise<ActionResult> {
  const user = await editor();
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const order = String(orderNo).trim();
  const value = String(category);
  if (value && !INDUSTRIES.some((i) => i.key === value)) {
    return { ok: false, message: "사업구분을 다시 선택하세요." };
  }
  const exists = await prisma.prodRecord.count({
    where: { orderNo: order, deletedAt: null, NOT: { orderNo: "" } },
  });
  if (!order || exists === 0) {
    return { ok: false, message: "제조내역에 없는 수주번호입니다." };
  }
  const now = await getNow();
  await prisma.$transaction((tx) => applyCategory(tx, user, now, order, value));
  refresh();
  return {
    ok: true,
    message: `${order}: ${value ? INDUSTRY_LABEL[value] : UNCLASSIFIED_LABEL}`,
  };
}
