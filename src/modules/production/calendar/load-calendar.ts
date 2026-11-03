// 납기 캘린더 조회 (서버 전용) — 숨긴 행 제외. 일정 묶기·출고 대기는 metrics/due-calendar.ts
import "server-only";

import { prisma } from "@/shared/db/client";

import {
  dueEvents,
  orderDueDates,
  type DueRecord,
} from "../metrics/due-calendar";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function loadCalendarData(findOrder: string) {
  const [rows, noDueDate, categories, orderRows] = await Promise.all([
    prisma.prodRecord.findMany({
      where: { deletedAt: null, dueDate: { not: null } },
      select: {
        id: true,
        sheetName: true,
        serialNo: true,
        modelCode: true,
        bushSize: true,
        rpm: true,
        power: true,
        orderNo: true,
        seller: true,
        finalClient: true,
        projectName: true,
        dueDate: true,
        shippedDate: true,
      },
    }),
    prisma.prodRecord.count({ where: { deletedAt: null, dueDate: null } }),
    prisma.prodOrderCategory.findMany({
      select: { orderNo: true, category: true },
    }),
    findOrder
      ? prisma.prodRecord.findMany({
          where: { deletedAt: null, orderNo: findOrder },
          select: { orderNo: true, dueDate: true },
        })
      : Promise.resolve([]),
  ]);
  const records: DueRecord[] = rows.map((r) => ({
    ...r,
    dueDate: iso(r.dueDate!),
    shippedDate: r.shippedDate ? iso(r.shippedDate) : null,
  }));
  return {
    events: dueEvents(
      records,
      new Map(categories.map((c) => [c.orderNo, c.category])),
    ),
    noDueDate,
    found: findOrder
      ? orderDueDates(
          orderRows.map((r) => ({
            orderNo: r.orderNo,
            dueDate: r.dueDate ? iso(r.dueDate) : null,
          })),
          findOrder,
        )
      : null,
  };
}
