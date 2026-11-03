// 서비스팀 집계 (순수 함수). 친구 저장소 backend/service/dashboard.py 규칙 그대로:
// - 기간 기준 = 출장 시작일. 출장 시작일이 없는 보고서는 어느 기간에도 넣지 않음
// - 출장 1건 = 출장보고서 1건
// - 유상 비율 = 유상 ÷ (유상 + 무상). 비용청구 미입력은 비율에서 뺌
// - 수리 제품 대수 = 입력된 수량만 합함
// - 금액(부품 비용·매출)은 계산하지 않는다
import type { ServiceOverview } from "@/shared/contracts/service";

export type ReportRow = {
  billing: "PAID" | "FREE" | null;
  productQuantities: (number | null)[];
  sample: boolean;
};

export function serviceOverview(reports: ReportRow[]): ServiceOverview {
  const paid = reports.filter((r) => r.billing === "PAID").length;
  const free = reports.filter((r) => r.billing === "FREE").length;
  return {
    trips: reports.length,
    paid,
    free,
    billingUnset: reports.length - paid - free,
    paidRatio: paid + free > 0 ? paid / (paid + free) : null,
    productQuantity: reports.reduce(
      (n, r) =>
        n + r.productQuantities.reduce<number>((m, q) => m + (q ?? 0), 0),
      0,
    ),
    hasSample: reports.some((r) => r.sample),
  };
}
