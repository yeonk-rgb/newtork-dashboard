"use server";
// 단가 Server Action — 뉴토크 기준값 바로 고치기(더블클릭), 부품 추가(수기), 부품·단가 숨김·복구
// 권한: 입력·수정 = 서비스 edit(팀장 이상), 숨김·복구 = confirm. 삭제 대신 숨김 + 변경 이력 (service-unit-prices)
import { refresh } from "next/cache";
import { z } from "zod";

import { diffFields } from "@/shared/audit/diff";
import { recordAudit } from "@/shared/audit/record";
import { getCurrentUser, type AppUser } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import { getNow } from "@/shared/time/now";

import { NO_EDIT_MESSAGE, serviceAbilities } from "../rules";
import { BASE_PRICE_FIELD, ITEM_AUDIT_FIELDS } from "./audit-fields";
import { itemKey, partKey } from "./compute";
import { readPrice } from "./parse-upload";

export type ActionResult = {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
  /** 부품 추가: 같은 부품이 이미 있음 — 화면이 확인창을 띄우고 overwrite: true 로 다시 보냄 */
  confirm?: string;
};

const SCREEN = "service-unit-prices";
const CONFLICT = "다른 사람이 먼저 수정했습니다. 새로고침 후 다시 시도하세요.";
class ConflictError extends Error {}
const actor = (u: AppUser) => ({ id: u.id, loginId: u.loginId });

async function userWith(kind: "canEdit" | "canHide") {
  const user = await getCurrentUser();
  return user && serviceAbilities(user)[kind] ? user : null;
}

async function run(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const r = await fn();
    if (r.ok) refresh();
    return r;
  } catch (error) {
    if (error instanceof ConflictError) return { ok: false, message: CONFLICT };
    throw error;
  }
}

/** 금액 글자 → bigint | null (빈칸 = 미입력) */
function priceFrom(
  raw: unknown,
): { ok: true; value: bigint | null } | { ok: false; message: string } {
  const p = readPrice(typeof raw === "string" ? raw : null);
  return p.ok
    ? { ok: true, value: p.value === null ? null : BigInt(p.value) }
    : { ok: false, message: p.message.replace("금액", "기준값") };
}

// ---------- 뉴토크 기준값 (부품별 비교 표에서 더블클릭) ----------

export async function updateBasePrice(
  id: string,
  updatedAt: string,
  raw: string,
): Promise<ActionResult> {
  const user = await userWith("canEdit");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const price = priceFrom(String(raw ?? ""));
  if (!price.ok) return { ok: false, message: price.message };
  const now = await getNow();
  return run(() =>
    prisma.$transaction(async (tx) => {
      const before = await tx.svcPriceItem.findUnique({
        where: { id: String(id) },
      });
      if (!before || before.deletedAt) throw new ConflictError();
      const updated = await tx.svcPriceItem.updateMany({
        where: { id: before.id, updatedAt: new Date(updatedAt) },
        data: { basePrice: price.value, updatedById: user.id },
      });
      if (updated.count === 0) throw new ConflictError();
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "service",
        screen: SCREEN,
        action: "UPDATE",
        target: {
          type: "SvcPriceItem",
          id: before.id,
          label: `${before.partNo} ${before.name}`,
        },
        changes: diffFields(before, { basePrice: price.value }, [
          BASE_PRICE_FIELD,
        ]),
      });
      return {
        ok: true,
        message: `${before.partNo} 뉴토크 기준값을 ${
          price.value === null
            ? "비웠습니다"
            : `${price.value.toLocaleString("ko-KR")}원으로 저장했습니다`
        }.`,
      };
    }),
  );
}

// ---------- 부품 추가 (수기 입력) ----------
// 같은 부품(친구 앱: 같은 파트넘버)이 있으면 확인 후 덮어씀. 이 저장소는 파트넘버가 같고 품목이 다른 부품이 있을 수 있어
// 그 파트넘버 부품이 1개면 그 부품, 여럿이면 파트넘버·품목이 같은 부품을 덮어쓸 대상으로 본다

const itemSchema = z.object({
  category: z.string().trim().max(100).default(""),
  partNo: z.string().trim().min(1, "파트넘버를 입력하세요.").max(100),
  name: z.string().trim().min(1, "품목을 입력하세요.").max(200),
  appliesTo: z.string().trim().max(200).default(""),
  basePrice: z.string().default(""),
});

export async function createPriceItem(
  raw: unknown,
  overwrite = false,
): Promise<ActionResult> {
  const user = await userWith("canEdit");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = Object.fromEntries(
      parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
    );
    return { ok: false, message: parsed.error.issues[0].message, errors };
  }
  const v = parsed.data;
  const price = priceFrom(v.basePrice);
  if (!price.ok) {
    return {
      ok: false,
      message: price.message,
      errors: { basePrice: price.message },
    };
  }
  const key = itemKey(v.partNo, v.name);
  if (!partKey(v.partNo)) {
    const message = "파트넘버를 입력하세요.";
    return { ok: false, message, errors: { partNo: message } };
  }
  const now = await getNow();
  return run(() =>
    prisma.$transaction(
      async (tx) => {
        const samePart = await tx.svcPriceItem.findMany({
          where: { partKey: partKey(v.partNo) },
        });
        const same =
          samePart.find((i) => i.itemKey === key) ??
          (samePart.length === 1 ? samePart[0] : null);
        const data = {
          partNo: v.partNo,
          category: v.category,
          name: v.name,
          appliesTo: v.appliesTo,
          basePrice: price.value,
        };
        if (same?.deletedAt) {
          const message = `숨긴 부품 중에 같은 부품(${same.partNo} ${same.name})이 있습니다. 부품별 비교의 [숨긴 부품 보기]에서 복구한 뒤 고치세요.`;
          return { ok: false, message, errors: { partNo: message } };
        }
        if (same && !overwrite) {
          return {
            ok: false,
            message: "같은 부품이 이미 있습니다.",
            confirm: `파트넘버 ${same.partNo}(${same.name})가 이미 있습니다. 새 내용으로 덮어쓸까요?`,
          };
        }
        if (same) {
          // 다른 부품과 파트넘버·품목이 겹치면 덮어쓰지 않음 (고유 칸)
          if (key !== same.itemKey && samePart.some((i) => i.itemKey === key)) {
            throw new ConflictError();
          }
          await tx.svcPriceItem.update({
            where: { id: same.id },
            data: { ...data, itemKey: key, updatedById: user.id },
          });
          await recordAudit(tx, {
            occurredAt: now,
            actor: actor(user),
            area: "service",
            screen: SCREEN,
            action: "UPDATE",
            target: {
              type: "SvcPriceItem",
              id: same.id,
              label: `${v.partNo} ${v.name}`,
            },
            changes: diffFields(same, data, ITEM_AUDIT_FIELDS),
          });
          return {
            ok: true,
            message: `${v.partNo} ${v.name}을(를) 새 내용으로 덮어썼습니다.`,
          };
        }
        const last = await tx.svcPriceItem.aggregate({
          _max: { sortOrder: true },
        });
        const item = await tx.svcPriceItem.create({
          data: {
            ...data,
            partKey: partKey(v.partNo),
            itemKey: key,
            sortOrder: (last._max.sortOrder ?? 0) + 1,
            createdById: user.id,
            updatedById: user.id,
          },
        });
        await recordAudit(tx, {
          occurredAt: now,
          actor: actor(user),
          area: "service",
          screen: SCREEN,
          action: "CREATE",
          target: {
            type: "SvcPriceItem",
            id: item.id,
            label: `${item.partNo} ${item.name}`,
          },
          changes: diffFields(null, data, ITEM_AUDIT_FIELDS),
        });
        return {
          ok: true,
          message: `${item.partNo} ${item.name}을(를) 추가했습니다.`,
        };
      },
      { isolationLevel: "Serializable" },
    ),
  );
}

// ---------- 숨김·복구 ----------

export async function setPriceItemHidden(
  id: string,
  hide: boolean,
): Promise<ActionResult> {
  const user = await userWith("canHide");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const now = await getNow();
  return run(() =>
    prisma.$transaction(async (tx) => {
      const item = await tx.svcPriceItem.findUnique({
        where: { id: String(id) },
      });
      if (!item || (item.deletedAt !== null) === hide)
        throw new ConflictError();
      await tx.svcPriceItem.update({
        where: { id: item.id },
        data: hide
          ? { deletedAt: now, deletedById: user.id, updatedById: user.id }
          : { deletedAt: null, deletedById: null, updatedById: user.id },
      });
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "service",
        screen: SCREEN,
        action: hide ? "HIDE" : "RESTORE",
        target: {
          type: "SvcPriceItem",
          id: item.id,
          label: `${item.partNo} ${item.name}`,
        },
        changes: [],
      });
      return {
        ok: true,
        message: `${item.partNo} ${item.name}을(를) ${hide ? "숨겼습니다" : "복구했습니다"}.`,
      };
    }),
  );
}

export async function setPriceQuoteHidden(
  id: string,
  hide: boolean,
): Promise<ActionResult> {
  const user = await userWith("canHide");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const now = await getNow();
  return run(() =>
    prisma.$transaction(async (tx) => {
      const q = await tx.svcPriceQuote.findUnique({
        where: { id: String(id) },
      });
      if (!q || (q.deletedAt !== null) === hide) throw new ConflictError();
      const item = await tx.svcPriceItem.findUnique({
        where: { id: q.itemId },
      });
      if (!item || item.deletedAt) throw new ConflictError();
      await tx.svcPriceQuote.update({
        where: { id: q.id },
        data: hide
          ? { deletedAt: now, deletedById: user.id, updatedById: user.id }
          : { deletedAt: null, deletedById: null, updatedById: user.id },
      });
      const day = q.effectiveDate.toISOString().slice(0, 10);
      const label = `${item.partNo} · ${q.company} · ${day}`;
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "service",
        screen: SCREEN,
        action: hide ? "HIDE" : "RESTORE",
        target: { type: "SvcPriceQuote", id: q.id, label },
        changes: [],
      });
      return {
        ok: true,
        message: `${label} 단가를 ${hide ? "숨겼습니다" : "복구했습니다"}.`,
      };
    }),
  );
}
