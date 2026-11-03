// 변경 기록 넣기 — 원래 저장과 같은 트랜잭션(tx)에서 부른다. 기록이 실패하면 저장도 함께 취소된다 (2026-10-25 결정)
// 비밀번호·해시·토큰 같은 칸이 있으면 저장하지 않고 에러 (forbidden.ts)
import { z } from "zod";

import type { Prisma } from "@/shared/db/generated/client";

import { findForbiddenKeys, isForbiddenKey } from "./forbidden";
import { AUDIT_ACTIONS, AUDIT_AREAS, type AuditEntry } from "./types";

/** prisma 트랜잭션 클라이언트 중 기록 표만 — 테스트에서는 가짜를 넣는다 */
export type AuditTx = Pick<Prisma.TransactionClient, "auditLog">;

export class AuditForbiddenFieldError extends Error {
  constructor(readonly keys: string[]) {
    super(`변경 기록에 넣을 수 없는 칸이 있습니다: ${keys.join(", ")}`);
    this.name = "AuditForbiddenFieldError";
  }
}

const entrySchema = z.object({
  occurredAt: z.date(),
  actor: z.object({ id: z.string().min(1), loginId: z.string().min(1) }),
  area: z.enum(AUDIT_AREAS),
  screen: z.string().min(1).max(40),
  action: z.enum(AUDIT_ACTIONS),
  target: z.object({
    type: z.string().min(1).max(40),
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(200),
  }),
  changes: z
    .array(
      z.object({
        field: z.string().min(1),
        label: z.string().min(1),
        before: z.string().nullable(),
        after: z.string().nullable(),
      }),
    )
    .default([]),
  meta: z.record(z.string(), z.unknown()).optional(),
});

/**
 * 기록 한 건 넣기. 수정(UPDATE·확정 후 수정)인데 바뀐 칸이 없으면 기록하지 않고 false
 * (바뀌기 전/후가 같은 칸은 기록하지 않는다 — 2026-10-25 결정)
 */
export async function recordAudit(
  tx: AuditTx,
  entry: AuditEntry,
): Promise<boolean> {
  const forbidden = [
    ...(entry.changes ?? []).map((c) => c.field).filter(isForbiddenKey),
    ...findForbiddenKeys(entry.meta ?? {}, "meta"),
  ];
  if (forbidden.length > 0) throw new AuditForbiddenFieldError(forbidden);

  const e = entrySchema.parse(entry);
  if (
    (e.action === "UPDATE" || e.action === "UPDATE_CONFIRMED") &&
    e.changes.length === 0
  ) {
    return false;
  }
  await tx.auditLog.create({
    data: {
      occurredAt: e.occurredAt,
      actorId: e.actor.id,
      actorLoginId: e.actor.loginId,
      area: e.area,
      screen: e.screen,
      action: e.action,
      targetType: e.target.type,
      targetId: e.target.id,
      targetLabel: e.target.label,
      changes: e.changes,
      ...(e.meta ? { meta: e.meta as Prisma.InputJsonValue } : {}),
    },
  });
  return true;
}
