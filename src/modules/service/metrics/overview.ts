// 서비스팀 메인 "팀별 현황" 카드 (순수 함수) — 서비스 대시보드와 같은 summarize() (metrics/dashboard.ts) 를 쓴다
// 친구 저장소 backend/service/dashboard.py 규칙: 출장 시작일 기준, 출장 1건 = 보고서 1건,
// 유상 비율 = 유상 ÷ (유상 + 무상)(미입력 제외), 수리 제품 대수 = 입력된 수량만, 금액은 계산하지 않음
import type { ServiceOverview } from "@/shared/contracts/service";

import { summarize } from "./dashboard";

export type ReportRow = {
  billing: "PAID" | "FREE" | null;
  productQuantities: (number | null)[];
  sample: boolean;
};

export function serviceOverview(reports: ReportRow[]): ServiceOverview {
  const s = summarize(
    reports.map((r) => ({
      billing: r.billing,
      products: r.productQuantities.map((quantity) => ({ quantity })),
      parts: [],
    })),
  );
  return {
    trips: s.trips,
    paid: s.paid,
    free: s.free,
    billingUnset: s.billingUnset,
    paidRatio: s.paidRatio,
    productQuantity: s.productQty,
    hasSample: reports.some((r) => r.sample),
  };
}
