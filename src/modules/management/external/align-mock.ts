// 목업 비중의 합계를 실제 확정 총매출에 맞춘다 (시연 때 매출 카드와 원형 그래프 합계가 다르지 않게).
// 비중만 가상이고 합계는 실제. 생산팀 실제 데이터(source: "production")는 건드리지 않는다.
// 통합 후 실제 데이터로 바뀌면 이 맞춤은 필요 없다 (docs/integration-notes.md).
import type { SalesShareResult } from "@/shared/contracts/production";

export function alignMockToTotal(
  result: SalesShareResult,
  total: bigint,
): SalesShareResult {
  if (result.source !== "mock") return result;

  const mockSum = result.items.reduce((acc, item) => acc + item.amount, 0n);
  if (total <= 0n || mockSum === 0n) return { ...result, items: [] };

  const factor = Number(total) / Number(mockSum);
  const items = result.items.map((item) => ({
    ...item,
    amount: (item.amount * total) / mockSum, // 버림
    quantity: Math.max(1, Math.round(item.quantity * factor)),
  }));

  // 버림으로 생긴 원 단위 차이는 가장 큰 항목에 더해 합계를 정확히 맞춘다
  const diff = total - items.reduce((acc, item) => acc + item.amount, 0n);
  const largest = items.reduce(
    (max, item, i) => (item.amount > items[max].amount ? i : max),
    0,
  );
  items[largest] = { ...items[largest], amount: items[largest].amount + diff };

  return { ...result, items };
}
