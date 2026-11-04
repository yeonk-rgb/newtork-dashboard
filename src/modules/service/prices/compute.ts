// 출장지별 부품 가격 계산 (순수 함수) — 친구 저장소 composables/sitePrices.js · PriceManage/BySite/Compare 화면 계산 그대로
// 가격이 없는 출장지·부품 조합은 "미입력"이며 다른 값으로 채우지 않는다. 평균은 미입력 제외
export type Price = {
  siteId: string;
  siteName: string;
  partId: string;
  partName: string;
  unitPrice: number;
  note: string;
};
export type NamedRow = { id: string; name: string };

export const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** 평균 대비 차이(%) 소수 1자리 — 평균이 없으면 null (친구 diffPct: Math.round 그대로) */
export const diffPct = (value: number, avg: number | null) =>
  avg ? Math.round(((value - avg) / avg) * 1000) / 10 : null;

export const signedPct = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "-"
    : `${v > 0 ? "+" : ""}${v.toLocaleString("ko-KR")}%`;

const cmp = (a: string, b: string) => a.localeCompare(b);

/** 부품 가격 관리 KPI — 고른 부품의 등록 출장지 수·최저·최고·평균 */
export function partStats(prices: Price[], partId: string) {
  const vals = prices
    .filter((p) => p.partId === partId)
    .map((p) => p.unitPrice);
  return {
    count: vals.length,
    min: vals.length ? Math.min(...vals) : null,
    max: vals.length ? Math.max(...vals) : null,
    avg: average(vals),
  };
}

/** 출장지별 가격 조회 — 그 출장지의 부품별 단가·전체 출장지 평균·평균 대비 (가격 높은 순, 미입력은 뒤) */
export function siteRows(
  prices: Price[],
  parts: NamedRow[],
  siteId: string,
  opts: { search?: string; showMissing?: boolean } = {},
) {
  const avgOf = new Map<string, { avg: number | null; sites: number }>();
  for (const part of parts) {
    const v = prices
      .filter((p) => p.partId === part.id)
      .map((p) => p.unitPrice);
    avgOf.set(part.id, { avg: average(v), sites: v.length });
  }
  const k = (opts.search ?? "").trim().toLowerCase();
  const mine = new Map(
    prices.filter((p) => p.siteId === siteId).map((p) => [p.partId, p]),
  );
  const rows = parts
    .filter((p) => !k || p.name.toLowerCase().includes(k))
    .map((part) => {
      const cur = mine.get(part.id);
      const { avg, sites } = avgOf.get(part.id)!;
      return {
        part,
        price: cur?.unitPrice ?? null,
        note: cur?.note ?? "",
        avg,
        avgSites: sites,
        diff: cur ? diffPct(cur.unitPrice, avg) : null,
      };
    })
    .filter((r) => opts.showMissing !== false || r.price !== null)
    .sort(
      (a, b) =>
        (b.price ?? -1) - (a.price ?? -1) || cmp(a.part.name, b.part.name),
    );
  const priced = rows.filter((r) => r.price !== null);
  return { rows, priced, siteAvg: average(priced.map((r) => r.price!)) };
}

/** 처음 고를 출장지 — 가격이 가장 많이 등록된 곳 (같으면 목록 앞쪽) */
export function defaultSite(sites: NamedRow[], prices: Price[]) {
  const count = (id: string) => prices.filter((p) => p.siteId === id).length;
  return [...sites].sort((a, b) => count(b.id) - count(a.id))[0]?.id ?? null;
}

/** 처음 고를 부품 — 가격이 등록된 출장지가 가장 많은 부품 */
export function defaultPart(parts: NamedRow[], prices: Price[]) {
  const count = (id: string) => prices.filter((p) => p.partId === id).length;
  return [...parts].sort((a, b) => count(b.id) - count(a.id))[0]?.id ?? null;
}

/** 출장지 비교 분석 — ① 부품 하나의 출장지별 가격 ② 출장지별 평균 부품 단가(공통 부품만 / 전체) */
export function compare(
  prices: Price[],
  sites: NamedRow[],
  partId: string | null,
  excluded: Set<string>,
  commonOnly: boolean,
) {
  const selected = sites.filter((s) => !excluded.has(s.id));
  const ids = new Set(selected.map((s) => s.id));
  const partRows = prices
    .filter((p) => p.partId === partId && ids.has(p.siteId))
    .map((p) => ({ label: p.siteName, value: p.unitPrice, note: p.note }))
    .sort((a, b) => b.value - a.value);
  const partAvg = average(partRows.map((r) => r.value));
  const partMax = partRows[0] ?? null;
  const partMin = partRows.at(-1) ?? null;
  const missingSites = selected.filter(
    (s) => !partRows.some((r) => r.label === s.name),
  );

  const bySite = new Map<string, Set<string>>();
  for (const p of prices) {
    if (!ids.has(p.siteId)) continue;
    bySite.set(p.partId, (bySite.get(p.partId) ?? new Set()).add(p.siteId));
  }
  const commonParts = new Set(
    ids.size
      ? [...bySite].filter(([, s]) => s.size === ids.size).map(([pid]) => pid)
      : [],
  );
  // 공통 부품이 하나도 없으면 '등록된 부품 전체'로 계산하고 화면에 알린다
  const useCommon = commonOnly && commonParts.size > 0;
  const siteAvgRows = selected
    .flatMap((s) => {
      const vals = prices
        .filter(
          (p) => p.siteId === s.id && (!useCommon || commonParts.has(p.partId)),
        )
        .map((p) => p.unitPrice);
      return vals.length
        ? [
            {
              label: s.name,
              value: Math.round(average(vals)!),
              parts: vals.length,
            },
          ]
        : [];
    })
    .sort((a, b) => b.value - a.value);
  return {
    selected,
    partRows,
    partAvg,
    partMin,
    partMax,
    missingSites,
    commonParts,
    useCommon,
    siteAvgRows,
    overallAvg: average(siteAvgRows.map((r) => r.value)),
  };
}
