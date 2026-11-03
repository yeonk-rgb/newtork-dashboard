// 제조내역 목록 조회 (서버 전용) — 친구 저장소 ProductionRecordViewSet 필터 그대로 + 숨긴 행 보기
import "server-only";

import { prisma } from "@/shared/db/client";
import type { Prisma } from "@/shared/db/generated/client";
import { INDUSTRIES } from "@/shared/contracts/production";

import { COLUMNS, type RecordField } from "../upload/columns";

export const PAGE_SIZE = 50;

export type RecordFilter = {
  q: string;
  model: string;
  /** 사업구분 코드, "none" = 미분류, "" = 전체 */
  category: string;
  /** "yes" 출고됨 / "none" 출고일 없음 / "" 전체 */
  shipped: string;
  shippedFrom: string;
  shippedTo: string;
  hidden: boolean;
  page: number;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: string | string[] | undefined) =>
  (typeof v === "string" ? v : "").trim();

export function parseRecordFilter(
  params: Record<string, string | string[] | undefined>,
): RecordFilter {
  const category = str(params.category);
  const shipped = str(params.shipped);
  const page = Number(str(params.page));
  return {
    q: str(params.q).slice(0, 100),
    model: str(params.model).slice(0, 20),
    category:
      category === "none" || INDUSTRIES.some((i) => i.key === category)
        ? category
        : "",
    shipped: shipped === "yes" || shipped === "none" ? shipped : "",
    shippedFrom: DATE.test(str(params.from)) ? str(params.from) : "",
    shippedTo: DATE.test(str(params.to)) ? str(params.to) : "",
    hidden: str(params.hidden) === "1",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** 필터 → 주소 (쪽 이동이 같은 조건을 쓰게) */
export function recordSearch(filter: RecordFilter, page = filter.page) {
  const p = new URLSearchParams();
  if (filter.q) p.set("q", filter.q);
  if (filter.model) p.set("model", filter.model);
  if (filter.category) p.set("category", filter.category);
  if (filter.shipped) p.set("shipped", filter.shipped);
  if (filter.shippedFrom) p.set("from", filter.shippedFrom);
  if (filter.shippedTo) p.set("to", filter.shippedTo);
  if (filter.hidden) p.set("hidden", "1");
  if (page > 1) p.set("page", String(page));
  return p.toString();
}

const utc = (d: string) => new Date(`${d}T00:00:00Z`);

async function categoryWhere(
  category: string,
): Promise<Prisma.ProdRecordWhereInput> {
  if (!category) return {};
  const rows = await prisma.prodOrderCategory.findMany({
    where: category === "none" ? {} : { category: category as never },
    select: { orderNo: true },
  });
  const orders = rows.map((r) => r.orderNo);
  return category === "none"
    ? { orderNo: { notIn: orders } }
    : { orderNo: { in: orders } };
}

const SELECT = {
  ...(Object.fromEntries(COLUMNS.map((c) => [c.field, true])) as Record<
    RecordField,
    true
  >),
  id: true,
  sheetName: true,
  quantity: true,
  sourceRow: true,
  importWarnings: true,
  updatedAt: true,
  updatedById: true,
  deletedAt: true,
  batch: { select: { fileName: true } },
} as const;

export async function loadRecordPage(filter: RecordFilter) {
  const where: Prisma.ProdRecordWhereInput = {
    deletedAt: filter.hidden ? { not: null } : null,
    ...(filter.q
      ? {
          OR: (
            [
              "serialNo",
              "orderNo",
              "seller",
              "finalClient",
              "projectName",
            ] as const
          ).map((f) => ({
            [f]: { contains: filter.q, mode: "insensitive" as const },
          })),
        }
      : {}),
    ...(filter.model ? { modelCode: filter.model } : {}),
    ...(filter.shipped === "yes" ? { shippedDate: { not: null } } : {}),
    ...(filter.shipped === "none" ? { shippedDate: null } : {}),
    ...(filter.shippedFrom || filter.shippedTo
      ? {
          shippedDate: {
            ...(filter.shippedFrom ? { gte: utc(filter.shippedFrom) } : {}),
            ...(filter.shippedTo ? { lte: utc(filter.shippedTo) } : {}),
          },
        }
      : {}),
    ...(await categoryWhere(filter.category)),
  };
  const [{ total, rows }, models] = await Promise.all([
    loadRecordList(where, {
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.prodRecord.findMany({
      where: { deletedAt: null },
      distinct: ["modelCode"],
      select: { modelCode: true },
      orderBy: { modelCode: "asc" },
    }),
  ]);
  return {
    total,
    rows,
    models: models.map((m) => m.modelCode).filter(Boolean),
  };
}

/** 조건에 맞는 제조내역 + 전체 행 수 (사업구분 붙임) — 제조내역 표·일련번호 검색 공용 */
export async function loadRecordList(
  where: Prisma.ProdRecordWhereInput,
  page: { skip?: number; take: number },
) {
  const [total, rows] = await Promise.all([
    prisma.prodRecord.count({ where }),
    prisma.prodRecord.findMany({
      where,
      select: SELECT,
      orderBy: [{ sheetName: "asc" }, { serialNo: "asc" }],
      ...page,
    }),
  ]);
  const categories = await prisma.prodOrderCategory.findMany({
    where: { orderNo: { in: [...new Set(rows.map((r) => r.orderNo))] } },
    select: { orderNo: true, category: true },
  });
  const categoryOf = new Map(categories.map((c) => [c.orderNo, c.category]));
  return {
    total,
    rows: rows.map((r) => ({
      ...r,
      category: (r.orderNo && categoryOf.get(r.orderNo)) || null,
    })),
  };
}

export type RecordRowData = Awaited<
  ReturnType<typeof loadRecordList>
>["rows"][number];
