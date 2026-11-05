// 단가 업로드 저장 (서버 전용) — 한 트랜잭션(Serializable) 안에서 다시 판정하고 저장 + 변경 이력 요약 1건
// - 새 행 저장, 바뀐 행은 모두 덮어씀(2026-11-05 피드백 "추가 업로드 시 동일 내용 덮어쓰기"), 같은 행·숨긴 행은 그대로
// - 오류가 1건이라도 있으면 저장하지 않음, 저장할 내용이 없으면 오류
import "server-only";

import { recordAudit } from "@/shared/audit/record";
import type { AppUser } from "@/shared/auth";
import { prisma } from "@/shared/db/client";

import {
  classifyItems,
  classifyQuotes,
  type Judged,
  type ResolvedQuote,
} from "./classify";
import { loadExistingItems, loadExistingQuotes } from "./load-unit-prices";
import {
  UPLOAD_KIND_LABEL,
  type ItemValues,
  type QuoteValues,
  type RowError,
  type UploadKind,
} from "./parse-upload";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export type Rows<T> = { row: number; values: T }[];

/** 미리보기·저장 공용 판정 (parse 오류 + 판정 오류를 합침) */
export async function judgeItems(
  rows: Rows<ItemValues>,
  parseErrors: RowError[],
  tx: Parameters<typeof loadExistingItems>[0] = prisma,
): Promise<Judged<ItemValues>> {
  const j = classifyItems(rows, await loadExistingItems(tx));
  return { ...j, errors: [...parseErrors, ...j.errors] };
}

export async function judgeQuotes(
  rows: Rows<QuoteValues>,
  parseErrors: RowError[],
  tx: Parameters<typeof loadExistingItems>[0] = prisma,
): Promise<Judged<ResolvedQuote>> {
  const items = await loadExistingItems(tx);
  const quotes = await loadExistingQuotes(tx);
  const j = classifyQuotes(rows, items, quotes);
  return {
    ...j,
    errors: [...parseErrors, ...j.errors].sort((a, b) => a.row - b.row),
  };
}

const utcDate = (d: string) => new Date(`${d}T00:00:00Z`);

export async function saveUpload(input: {
  kind: UploadKind;
  fileName: string;
  rows: Rows<ItemValues> | Rows<QuoteValues>;
  parseErrors: RowError[];
  user: AppUser;
  now: Date;
}) {
  const { kind, fileName, user, now } = input;
  return prisma.$transaction(
    async (tx) => {
      const j =
        kind === "items"
          ? await judgeItems(
              input.rows as Rows<ItemValues>,
              input.parseErrors,
              tx,
            )
          : await judgeQuotes(
              input.rows as Rows<QuoteValues>,
              input.parseErrors,
              tx,
            );
      if (j.errors.length) {
        throw new UploadError(
          `오류 ${j.errors.length}건이 있어 저장하지 않았습니다. 파일을 고친 뒤 다시 올려 주세요.`,
        );
      }
      if (j.created.length === 0 && j.changed.length === 0) {
        throw new UploadError(
          "저장할 내용이 없습니다. 파일의 모든 행이 이미 저장된 값과 같습니다.",
        );
      }
      if (kind === "items") {
        const { created, changed } = j as Judged<ItemValues>;
        const last = await tx.svcPriceItem.aggregate({
          _max: { sortOrder: true },
        });
        const base = (last._max.sortOrder ?? 0) + 1;
        await tx.svcPriceItem.createMany({
          data: created.map(({ values: v }, i) => ({
            partNo: v.partNo,
            partKey: v.partKey,
            itemKey: v.key,
            category: v.category,
            name: v.name,
            appliesTo: v.appliesTo,
            basePrice: v.basePrice === null ? null : BigInt(v.basePrice),
            sortOrder: base + i,
            createdById: user.id,
            updatedById: user.id,
            createdAt: now,
            updatedAt: now,
          })),
        });
        for (const { id, values: v } of changed) {
          await tx.svcPriceItem.update({
            where: { id },
            data: {
              partNo: v.partNo,
              category: v.category,
              name: v.name,
              appliesTo: v.appliesTo,
              basePrice: v.basePrice === null ? null : BigInt(v.basePrice),
              updatedById: user.id,
            },
          });
        }
      } else {
        const { created, changed } = j as Judged<ResolvedQuote>;
        await tx.svcPriceQuote.createMany({
          data: created.map(({ values: v }, i) => ({
            itemId: v.itemId,
            company: v.company,
            unitPrice: BigInt(v.unitPrice),
            effectiveDate: utcDate(v.effectiveDate),
            note: v.note,
            createdById: user.id,
            updatedById: user.id,
            // 같은 날짜끼리 파일 순서를 지키려고 1ms 씩
            createdAt: new Date(now.getTime() + i),
            updatedAt: now,
          })),
        });
        for (const { id, values: v } of changed) {
          await tx.svcPriceQuote.update({
            where: { id },
            data: {
              unitPrice: BigInt(v.unitPrice),
              note: v.note,
              updatedById: user.id,
            },
          });
        }
      }
      await recordAudit(tx, {
        occurredAt: now,
        actor: { id: user.id, loginId: user.loginId },
        area: "service",
        screen: "service-unit-price-upload",
        action: "IMPORT",
        target: {
          type: kind === "items" ? "SvcPriceItem" : "SvcPriceQuote",
          id: kind,
          label: `${UPLOAD_KIND_LABEL[kind]} · ${fileName}`.slice(0, 200),
        },
        meta: {
          fileName,
          kind: UPLOAD_KIND_LABEL[kind],
          created: j.created.length,
          overwritten: j.changed.length,
          unchanged: j.unchanged.length,
          hidden: j.hidden.length,
        },
      });
      return { created: j.created.length, overwritten: j.changed.length };
    },
    { isolationLevel: "Serializable" },
  );
}
