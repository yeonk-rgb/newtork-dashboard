// 단가 계산 (순수 함수 — DB·화면 모름). 친구 우민영 저장소 lib/pricing.js 의 부품 단가 규칙을 옮김
// - 뉴토크 기준값 = 단가표 기준단가 그대로 (2026-11-05 담당자 피드백: 산식·할인율·추가단가 없앰, 화면에서 바로 고침)
// - 출장지별 단가 = 그 부품의 출장지(업체)마다 가장 최근 단가 1개 (오늘 이후 적용 예정 단가 제외)
// - 평균·최저·최고·최고−최저 = 위 출장지별 단가로 계산 (평균은 원 단위 반올림)
// - 기준값 대비 차이율 = (단가 − 기준값) ÷ 기준값 × 100, 소수 1자리 반올림. 기준값이 없거나 0원이면 계산하지 않음
//   (친구 앱은 견적 당시 단가표 개정본과 비교 — 이 저장소는 개정 이력이 없어 지금 기준값과 비교)
// - 크게 낮음: 차이율 ≤ −LOW_ALERT_RATE (할인 과다 점검)
// - 출장지별 비교의 평균 차이율 = 부품 차이율의 단순 평균 (부품 가격 크기와 상관없이 같은 무게)

/** 크게 낮음 기준(%) — 친구 앱 기본값. 화면에서 바꾸는 상자는 피드백으로 없앰 */
export const LOW_ALERT_RATE = 10;

export type ItemInput = {
  id: string;
  partNo: string;
  category: string;
  name: string;
  appliesTo: string;
  basePrice: number | null;
  sortOrder: number;
  updatedAt: string;
  hidden: boolean;
};

export type QuoteInput = {
  id: string;
  itemId: string;
  company: string;
  unitPrice: number;
  /** "YYYY-MM-DD" */
  effectiveDate: string;
  note: string;
  /** 수주 내역 판매번호·사업명, 올린 형식(table·order) */
  quoteNo: string;
  project: string;
  source: string;
  createdAt: string;
  hidden: boolean;
};

export type Stats = {
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
};

export type Compared = {
  diff: number | null;
  diffRate: number | null;
  low: boolean;
};

/** 파트넘버 비교용: 공백·하이픈 무시, 대문자 (예: "xx-05 a" → "XX05A") */
export const partKey = (t: string) => t.replace(/[\s-]/g, "").toUpperCase();

/** 같은 부품 판별 = 파트넘버 + 품목 (친구 UNIQUE(part_no, name)) — 품목은 공백만 무시, 대문자 */
export const itemKey = (partNo: string, name: string) =>
  `${partKey(partNo)}|${name.replace(/\s/g, "").toUpperCase()}`;

/** 소수 1자리 반올림 (절반은 0에서 먼 쪽 — 친구 decimal.js ROUND_HALF_UP) */
export function round1(v: number): number {
  const r = Math.round(Math.abs(v) * 10 + 1e-9) / 10;
  return v < 0 ? -r : r;
}

/** 검색: 파트넘버·품목에 포함 (공백·하이픈 무시). 숫자만 치면 파트넘버의 숫자만 모아 비교 (0501 → XX-05-A-01) */
export function matchesQuery(
  item: Pick<ItemInput, "partNo" | "name">,
  query: string,
): boolean {
  const q = partKey(query);
  if (!q) return true;
  const no = partKey(item.partNo);
  if (no.includes(q) || partKey(item.name).includes(q)) return true;
  return /^\d+$/.test(q) && no.replace(/\D/g, "").includes(q);
}

const byDateThenCreated = (a: QuoteInput, b: QuoteInput) =>
  a.effectiveDate.localeCompare(b.effectiveDate) ||
  a.createdAt.localeCompare(b.createdAt) ||
  a.id.localeCompare(b.id);

/** 출장지마다 가장 최근 단가 1개 (숨김·적용 예정 제외) */
export function latestByCompany(
  quotes: QuoteInput[],
  today: string,
): Map<string, QuoteInput> {
  const latest = new Map<string, QuoteInput>();
  for (const q of quotes
    .filter((x) => !x.hidden && x.effectiveDate <= today)
    .sort(byDateThenCreated)) {
    latest.set(q.company, q);
  }
  return latest;
}

export function priceStats(prices: number[]): Stats {
  if (prices.length === 0) {
    return { count: 0, average: null, min: null, max: null, range: null };
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return {
    count: prices.length,
    average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    min,
    max,
    range: max - min,
  };
}

export function compareToBase(
  basePrice: number | null,
  unitPrice: number,
): Compared {
  if (!basePrice) return { diff: null, diffRate: null, low: false };
  const diffRate = round1(((unitPrice - basePrice) / basePrice) * 100);
  return {
    diff: unitPrice - basePrice,
    diffRate,
    low: diffRate <= -LOW_ALERT_RATE,
  };
}

export type ItemRow = ItemInput & { stats: Stats };

export function itemRows(
  items: ItemInput[],
  quotes: QuoteInput[],
  today: string,
): ItemRow[] {
  const quotesOf = groupBy(quotes, (q) => q.itemId);
  return items.map((item) => ({
    ...item,
    stats: priceStats(
      [...latestByCompany(quotesOf.get(item.id) ?? [], today).values()].map(
        (q) => q.unitPrice,
      ),
    ),
  }));
}

export type QuoteRow = QuoteInput &
  Compared & {
    /** 평균·최저·최고 계산에 쓰인 단가 */
    latest: boolean;
    /** 오늘 이후 적용 */
    upcoming: boolean;
  };

/** 부품 상세: 출장지별 단가 (최신 적용일 → 출장지 이름순), 숨긴 단가는 맨 뒤 */
export function itemQuotes(
  item: Pick<ItemInput, "id" | "basePrice">,
  quotes: QuoteInput[],
  today: string,
): QuoteRow[] {
  const mine = quotes.filter((q) => q.itemId === item.id);
  const latestIds = new Set(
    [...latestByCompany(mine, today).values()].map((q) => q.id),
  );
  return mine
    .map((q) => ({
      ...q,
      ...compareToBase(item.basePrice, q.unitPrice),
      latest: latestIds.has(q.id),
      upcoming: q.effectiveDate > today,
    }))
    .sort(
      (a, b) =>
        Number(a.hidden) - Number(b.hidden) ||
        b.effectiveDate.localeCompare(a.effectiveDate) ||
        a.company.localeCompare(b.company, "ko") ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

export type CompanyPart = {
  itemId: string;
  partNo: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  effectiveDate: string;
  diff: number;
  diffRate: number;
  low: boolean;
};

export type CompanyRow = {
  company: string;
  count: number;
  averageRate: number;
  minRate: number;
  maxRate: number;
  /** 기준값보다 비쌈 (+) */
  above: number;
  /** 기준값보다 쌈 (−) */
  below: number;
  low: number;
  parts: CompanyPart[];
};

/** 출장지별 비교: 출장지가 견적한 부품마다 기준값 대비 차이율 → 출장지 단위로 모음 (기준값 없는 부품은 빠짐) */
export function companyComparison(
  items: ItemInput[],
  quotes: QuoteInput[],
  today: string,
): { companies: CompanyRow[]; lowCount: number } {
  const quotesOf = groupBy(quotes, (q) => q.itemId);
  const byCompany = new Map<string, CompanyPart[]>();
  for (const item of items) {
    if (item.hidden) continue;
    for (const [company, q] of latestByCompany(
      quotesOf.get(item.id) ?? [],
      today,
    )) {
      const c = compareToBase(item.basePrice, q.unitPrice);
      if (c.diffRate === null || c.diff === null) continue;
      const list = byCompany.get(company) ?? [];
      list.push({
        itemId: item.id,
        partNo: item.partNo,
        name: item.name,
        basePrice: item.basePrice!,
        unitPrice: q.unitPrice,
        effectiveDate: q.effectiveDate,
        diff: c.diff,
        diffRate: c.diffRate,
        low: c.low,
      });
      byCompany.set(company, list);
    }
  }
  const companies = [...byCompany].map(([company, parts]) => {
    const rates = parts.map((p) => p.diffRate);
    return {
      company,
      count: parts.length,
      averageRate: round1(rates.reduce((a, b) => a + b, 0) / rates.length),
      minRate: Math.min(...rates),
      maxRate: Math.max(...rates),
      above: rates.filter((r) => r > 0).length,
      below: rates.filter((r) => r < 0).length,
      low: parts.filter((p) => p.low).length,
      parts: parts.sort(
        (a, b) => b.diffRate - a.diffRate || a.partNo.localeCompare(b.partNo),
      ),
    };
  });
  companies.sort(
    (a, b) =>
      b.averageRate - a.averageRate || a.company.localeCompare(b.company, "ko"),
  );
  return { companies, lowCount: companies.reduce((n, c) => n + c.low, 0) };
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

/** 표시용 */
export const signedRate = (r: number) => `${r > 0 ? "+" : ""}${r}%`;
export const signedWon = (v: number) =>
  `${v > 0 ? "+" : ""}${v.toLocaleString("ko-KR")}원`;
