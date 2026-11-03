// 부품·출장지·출장지별 가격 조회 (서버 전용) — 친구 저장소 PartViewSet·SiteViewSet·SitePartPriceViewSet 그대로, 숨긴 것 제외
// 사용 보고서·출장보고서 수는 숨기지 않은 출장보고서만 센다
import "server-only";

import { prisma } from "@/shared/db/client";

import { regionLabel } from "../regions/regions";

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const liveReport = { deletedAt: null };

export type PartRow = {
  id: string;
  name: string;
  note: string;
  hidden: boolean;
  updatedAt: string;
  usageCount: number;
  priceSites: number;
  priceMin: number | null;
  priceMax: number | null;
  /** 이 부품을 교체한 출장지(요청처)와 보고서 수, 많은 순 */
  usedAt: { requestOrg: string; reports: number }[];
};

export async function loadParts(
  opts: { q?: string; noPrice?: boolean; hidden?: boolean } = {},
) {
  const [parts, usages, prices] = await Promise.all([
    prisma.svcPart.findMany({
      where: {
        deletedAt: opts.hidden ? { not: null } : null,
        ...(opts.q
          ? { name: { contains: opts.q, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { name: "asc" },
    }),
    prisma.svcReportPart.findMany({
      where: { report: liveReport },
      select: {
        partId: true,
        reportId: true,
        report: { select: { requestOrg: true } },
      },
    }),
    prisma.svcSitePartPrice.findMany({
      where: { deletedAt: null, site: { deletedAt: null } },
      select: { partId: true, unitPrice: true },
    }),
  ]);
  const rows: PartRow[] = parts.map((p) => {
    const us = usages.filter((u) => u.partId === p.id);
    const byOrg = new Map<string, Set<string>>();
    for (const u of us) {
      const org = u.report.requestOrg;
      byOrg.set(org, (byOrg.get(org) ?? new Set()).add(u.reportId));
    }
    const ps = prices
      .filter((x) => x.partId === p.id)
      .map((x) => Number(x.unitPrice));
    return {
      id: p.id,
      name: p.name,
      note: p.note,
      hidden: p.deletedAt !== null,
      updatedAt: p.updatedAt.toISOString(),
      usageCount: new Set(us.map((u) => u.reportId)).size,
      priceSites: ps.length,
      priceMin: ps.length ? Math.min(...ps) : null,
      priceMax: ps.length ? Math.max(...ps) : null,
      usedAt: [...byOrg]
        .map(([requestOrg, ids]) => ({ requestOrg, reports: ids.size }))
        .sort(
          (a, b) => b.reports - a.reports || cmp(a.requestOrg, b.requestOrg),
        ),
    };
  });
  return opts.noPrice ? rows.filter((r) => r.priceSites === 0) : rows;
}

export type SiteRow = {
  id: string;
  name: string;
  region: string | null;
  sigungu: string | null;
  regionLabel: string;
  note: string;
  hidden: boolean;
  updatedAt: string;
  reportCount: number;
  priceCount: number;
};

export async function loadSites(
  opts: { hidden?: boolean } = {},
): Promise<SiteRow[]> {
  const [sites, reports, prices] = await Promise.all([
    prisma.svcSite.findMany({
      where: { deletedAt: opts.hidden ? { not: null } : null },
      orderBy: { name: "asc" },
    }),
    prisma.svcReport.groupBy({
      by: ["requestOrg"],
      where: liveReport,
      _count: { _all: true },
    }),
    prisma.svcSitePartPrice.groupBy({
      by: ["siteId"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);
  const reportsOf = new Map(reports.map((r) => [r.requestOrg, r._count._all]));
  const pricesOf = new Map(prices.map((r) => [r.siteId, r._count._all]));
  return sites.map((s) => ({
    id: s.id,
    name: s.name,
    region: s.region,
    sigungu: s.sigungu,
    regionLabel: regionLabel(s.region, s.sigungu),
    note: s.note,
    hidden: s.deletedAt !== null,
    updatedAt: s.updatedAt.toISOString(),
    reportCount: reportsOf.get(s.name) ?? 0,
    priceCount: pricesOf.get(s.id) ?? 0,
  }));
}

export type PriceRow = {
  id: string;
  siteId: string;
  siteName: string;
  partId: string;
  partName: string;
  unitPrice: number;
  note: string;
  updatedById: string;
  updatedAt: string;
};

/** 숨기지 않은 출장지·부품의 가격 (출장지 이름·부품 이름 순 — 친구 SitePartPrice Meta.ordering) */
export async function loadPrices(): Promise<PriceRow[]> {
  const rows = await prisma.svcSitePartPrice.findMany({
    where: {
      deletedAt: null,
      site: { deletedAt: null },
      part: { deletedAt: null },
    },
    include: {
      site: { select: { name: true } },
      part: { select: { name: true } },
    },
  });
  return rows
    .map((r) => ({
      id: r.id,
      siteId: r.siteId,
      siteName: r.site.name,
      partId: r.partId,
      partName: r.part.name,
      unitPrice: Number(r.unitPrice),
      note: r.note,
      updatedById: r.updatedById,
      updatedAt: r.updatedAt.toISOString(),
    }))
    .sort((a, b) => cmp(a.siteName, b.siteName) || cmp(a.partName, b.partName));
}
