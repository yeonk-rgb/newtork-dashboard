// 사업구분 지정 화면 조회 (서버 전용) — 수주번호별 행 수·판매처·최종발주처·지정한 사업구분
// 행 수는 "이 수주번호에 적용되는 제조내역 행 수"일 뿐 생산 실적이 아니다 (친구 저장소 OrderCategoryListView)
import "server-only";

import { prisma } from "@/shared/db/client";

export type OrderRow = {
  orderNo: string;
  recordCount: number;
  sellers: string;
  finalClients: string;
  category: string | null;
};

const joined = (values: Set<string>) =>
  [...values]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ko"))
    .join(", ");

export async function loadOrders(filter: { q: string; onlyNone: boolean }) {
  const [records, categories, noOrder] = await Promise.all([
    prisma.prodRecord.findMany({
      where: { deletedAt: null, NOT: { orderNo: "" } },
      select: { orderNo: true, seller: true, finalClient: true },
    }),
    prisma.prodOrderCategory.findMany({
      select: { orderNo: true, category: true },
    }),
    prisma.prodRecord.count({ where: { deletedAt: null, orderNo: "" } }),
  ]);
  const categoryOf = new Map(categories.map((c) => [c.orderNo, c.category]));
  const groups = new Map<
    string,
    { count: number; sellers: Set<string>; clients: Set<string> }
  >();
  for (const r of records) {
    const g = groups.get(r.orderNo) ?? {
      count: 0,
      sellers: new Set<string>(),
      clients: new Set<string>(),
    };
    g.count++;
    g.sellers.add(r.seller);
    g.clients.add(r.finalClient);
    groups.set(r.orderNo, g);
  }
  const q = filter.q.toLowerCase();
  const all: OrderRow[] = [...groups]
    .map(([orderNo, g]) => ({
      orderNo,
      recordCount: g.count,
      sellers: joined(g.sellers),
      finalClients: joined(g.clients),
      category: categoryOf.get(orderNo) ?? null,
    }))
    .sort((a, b) => a.orderNo.localeCompare(b.orderNo));
  const rows = all.filter(
    (o) =>
      (!filter.onlyNone || o.category === null) &&
      (!q ||
        [o.orderNo, o.sellers, o.finalClients].some((v) =>
          v.toLowerCase().includes(q),
        )),
  );
  return {
    rows,
    total: all.length,
    unclassified: all.filter((o) => o.category === null).length,
    recordsWithoutOrder: noOrder,
  };
}
