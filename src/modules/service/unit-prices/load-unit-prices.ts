// 단가 조회 (서버 전용) — 숨긴 부품·단가도 읽어 오고(복구 화면용) 계산은 compute.ts 가 hidden 으로 거른다
import "server-only";

import { prisma } from "@/shared/db/client";
import type { Prisma } from "@/shared/db/generated/client";
import { getNow } from "@/shared/time/now";

import { SERVICE_SAMPLE_BY } from "../data/sample";
import type { ItemInput, QuoteInput } from "./compute";
import type { ExistingItem, ExistingQuote } from "./classify";
import { quoteKey } from "./classify";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** 오늘 (한국 날짜 "YYYY-MM-DD") */
export async function todayKst(): Promise<string> {
  return day(new Date((await getNow()).getTime() + 9 * 3600_000));
}

export async function loadUnitPriceData() {
  const [items, quotes, today] = await Promise.all([
    prisma.svcPriceItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { partNo: "asc" }],
    }),
    prisma.svcPriceQuote.findMany(),
    todayKst(),
  ]);
  const hiddenItem = new Set(items.filter((i) => i.deletedAt).map((i) => i.id));
  return {
    today,
    hasSample: items.some(
      (i) => i.createdById === SERVICE_SAMPLE_BY && !i.deletedAt,
    ),
    items: items.map((i): ItemInput => ({
      id: i.id,
      partNo: i.partNo,
      category: i.category,
      name: i.name,
      appliesTo: i.appliesTo,
      basePrice: i.basePrice === null ? null : Number(i.basePrice),
      sortOrder: i.sortOrder,
      updatedAt: i.updatedAt.toISOString(),
      hidden: i.deletedAt !== null,
    })),
    quotes: quotes.map((q): QuoteInput => ({
      id: q.id,
      itemId: q.itemId,
      company: q.company,
      unitPrice: Number(q.unitPrice),
      effectiveDate: day(q.effectiveDate),
      note: q.note,
      createdAt: q.createdAt.toISOString(),
      hidden: q.deletedAt !== null || hiddenItem.has(q.itemId),
    })),
  };
}

export type UnitPriceData = Awaited<ReturnType<typeof loadUnitPriceData>>;

type Tx = Pick<Prisma.TransactionClient, "svcPriceItem" | "svcPriceQuote">;

export async function loadExistingItems(
  tx: Tx = prisma,
): Promise<Map<string, ExistingItem>> {
  const rows = await tx.svcPriceItem.findMany();
  return new Map(
    rows.map((r) => [
      r.itemKey,
      {
        id: r.id,
        key: r.itemKey,
        partKey: r.partKey,
        partNo: r.partNo,
        category: r.category,
        name: r.name,
        appliesTo: r.appliesTo,
        basePrice: r.basePrice === null ? null : Number(r.basePrice),
        hidden: r.deletedAt !== null,
      },
    ]),
  );
}

export async function loadExistingQuotes(
  tx: Tx = prisma,
): Promise<Map<string, ExistingQuote>> {
  const rows = await tx.svcPriceQuote.findMany({
    select: {
      id: true,
      itemId: true,
      company: true,
      unitPrice: true,
      note: true,
      effectiveDate: true,
      deletedAt: true,
    },
  });
  return new Map(
    rows.map((r) => {
      const key = quoteKey(r.itemId, r.company, day(r.effectiveDate));
      return [
        key,
        {
          id: r.id,
          key,
          unitPrice: Number(r.unitPrice),
          note: r.note,
          hidden: r.deletedAt !== null,
        },
      ];
    }),
  );
}
