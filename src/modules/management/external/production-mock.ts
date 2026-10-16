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

/** 목업 매출 규모: 월 2억 안팎 (시드 매출과 비슷하게 — 실제 매출 카드와 동떨어져 보이지 않게) */
const MONTHLY_TOTAL = 200_000_000;
const UNIT_PRICE = 3_500_000; // 1대 평균 단가 (수량 계산용)

/**
 * 기간 총액을 먼저 정하고(두 그래프가 같은 총액), 고정 난수 비중으로 나눈다.
 * 같은 기간이면 산업분야·시리즈 합계가 같다.
 */
function mockShares(
  period: Period,
  categories: readonly { key: string; label: string }[],
  salt: string,
): SalesShareResult {
  const label = periodLabel(period);
  const months = periodMonths(period).length;
  const totalRandom = seededRandom(`total:${label}`);
  const total = Math.round(
    (MONTHLY_TOTAL * months * (0.9 + totalRandom() * 0.2)) / 1000,
  ); // 천 원 단위

  const random = seededRandom(`${salt}:${label}`);
  const weights = categories.map(() => 0.3 + random());
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const items: SalesShareItem[] = categories
    .map(({ key, label: name }, i) => {
      const amount =
        BigInt(Math.round((total * weights[i]) / weightSum)) * 1000n;
      const quantity = Math.max(1, Math.round(Number(amount) / UNIT_PRICE));
      return { key, label: name, amount, quantity };
    })
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
