// 생산팀 연동 목업 — docs/interface-production.md 형식 그대로.
// 통합 시 이 파일 대신 생산팀 modules/production/index.ts 의 함수를 쓴다.
import {
  INDUSTRIES,
  type SalesShareItem,
  type SalesShareResult,
} from "@/shared/contracts/production";
import { periodLabel, periodMonths, type Period } from "@/shared/period/period";

const SERIES = [
  { key: "SERIES_A", label: "시리즈 A(목업)" },
  { key: "SERIES_B", label: "시리즈 B(목업)" },
  { key: "SERIES_C", label: "시리즈 C(목업)" },
  { key: "SERIES_D", label: "시리즈 D(목업)" },
];

/** 같은 기간이면 항상 같은 값이 나오도록 기간 이름으로 만든 고정 난수 */
function seededRandom(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function mockShares(
  period: Period,
  categories: readonly { key: string; label: string }[],
  salt: string,
): SalesShareResult {
  const random = seededRandom(`${salt}:${periodLabel(period)}`);
  const months = periodMonths(period).length;
  const items: SalesShareItem[] = categories
    .map(({ key, label }) => {
      const quantity = Math.round((5 + random() * 40) * months);
      // 1대당 300만~900만 원, 천 원 단위
      const unitPrice = 3_000_000 + Math.round(random() * 6_000) * 1_000;
      return { key, label, quantity, amount: BigInt(quantity * unitPrice) };
    })
    .filter((item) => item.quantity > 0)
    .sort((a, b) => (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1));
  return { items, source: "mock" };
}

export async function getSalesShareByIndustry(
  period: Period,
): Promise<SalesShareResult> {
  return mockShares(period, INDUSTRIES, "industry");
}

export async function getSalesShareBySeries(
  period: Period,
): Promise<SalesShareResult> {
  return mockShares(period, SERIES, "series");
}
