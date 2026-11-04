// 가격 화면 3개 공용 조회 (서버 전용) — 친구 usePriceData(): 출장지·부품·출장지별 가격을 한 번에
import "server-only";

import { loadUserNames } from "@/shared/auth";
import { kstDateTime } from "@/shared/format/date-time";

import { loadParts, loadPrices, loadSites } from "../catalog/load-catalog";

export async function loadPriceData() {
  const [sites, parts, prices] = await Promise.all([
    loadSites(),
    loadParts(),
    loadPrices(),
  ]);
  const nameOf = await loadUserNames(prices.map((p) => p.updatedById));
  return {
    sites: sites.map((s) => ({
      id: s.id,
      name: s.name,
      regionLabel: s.regionLabel,
      priceCount: s.priceCount,
      reportCount: s.reportCount,
    })),
    parts: parts.map((p) => ({ id: p.id, name: p.name, note: p.note })),
    prices: prices.map((p) => ({
      ...p,
      updatedBy: nameOf(p.updatedById),
      updatedAtLabel: kstDateTime(new Date(p.updatedAt)),
    })),
  };
}

export type PriceData = Awaited<ReturnType<typeof loadPriceData>>;
