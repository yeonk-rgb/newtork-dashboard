// 서비스 대시보드 조회 (서버 전용) — 숨기지 않은 출장보고서 전부 + 부품별 출장지 가격 범위
import "server-only";

import { prisma } from "@/shared/db/client";

import type { DashRow, PartPrice } from "../metrics/dashboard";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function loadServiceDashRows(): Promise<{
  rows: DashRow[];
  noTripDate: number;
  partPrices: Map<string, PartPrice>;
}> {
  const [reports, prices] = await Promise.all([
    prisma.svcReport.findMany({
      where: { deletedAt: null },
      select: {
        tripStart: true,
        billing: true,
        region: true,
        sigungu: true,
        authorName: true,
        companions: { select: { name: true } },
        products: { select: { modelName: true, quantity: true } },
        parts: {
          select: {
            partId: true,
            quantity: true,
            part: { select: { name: true } },
          },
        },
      },
    }),
    prisma.svcSitePartPrice.findMany({
      where: { deletedAt: null, site: { deletedAt: null } },
      select: { partId: true, unitPrice: true },
    }),
  ]);
  const partPrices = new Map<string, PartPrice>();
  for (const p of prices) {
    const v = Number(p.unitPrice);
    const x = partPrices.get(p.partId) ?? { min: v, max: v, sites: 0 };
    x.min = Math.min(x.min!, v);
    x.max = Math.max(x.max!, v);
    x.sites++;
    partPrices.set(p.partId, x);
  }
  const rows = reports.map((r) => ({
    tripStart: iso(r.tripStart),
    billing: r.billing,
    region: r.region,
    sigungu: r.sigungu,
    authorName: r.authorName,
    companions: r.companions.map((c) => c.name),
    products: r.products,
    parts: r.parts.map((p) => ({
      partId: p.partId,
      name: p.part.name,
      quantity: p.quantity,
    })),
  }));
  return {
    rows,
    noTripDate: rows.filter((r) => !r.tripStart).length,
    partPrices,
  };
}
