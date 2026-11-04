// 서비스팀 메인 "팀별 현황" 카드·AI 입력 (순수 함수) — 서비스 대시보드와 같은 집계 함수(metrics/dashboard.ts)를 쓴다
// 친구 저장소 backend/service/dashboard.py 규칙: 출장 시작일 기준, 출장 1건 = 보고서 1건,
// 유상 비율 = 유상 ÷ (유상 + 무상)(미입력 제외), 수리 제품 대수 = 입력된 수량만, 금액은 계산하지 않음
import type { ServiceOverview } from "@/shared/contracts/service";

import { partRanking, regional, summarize, type DashRow } from "./dashboard";

export type ReportRow = Pick<
  DashRow,
  "billing" | "region" | "sigungu" | "parts"
> & {
  productQuantities: (number | null)[];
  sample: boolean;
};

export function serviceOverview(reports: ReportRow[]): ServiceOverview {
  const s = summarize(
    reports.map((r) => ({
      billing: r.billing,
      products: r.productQuantities.map((quantity) => ({ quantity })),
      parts: r.parts,
    })),
  );
  const region = regional(
    reports.map((r) => ({
      ...r,
      tripStart: null,
      authorName: "",
      companions: [],
      products: [],
    })),
  );
  const best = [...region.bySigungu, ...region.byRegionOnly].sort(
    (a, b) => b.trips - a.trips,
  )[0];
  return {
    trips: s.trips,
    paid: s.paid,
    free: s.free,
    billingUnset: s.billingUnset,
    paidRatio: s.paidRatio,
    productQuantity: s.productQty,
    topRegion: best
      ? { label: best.label, trips: best.trips, ratio: best.ratio ?? 0 }
      : null,
    regionUnassigned: region.unassigned,
    topParts: partRanking(reports)
      .filter((p) => !p.isOther)
      .slice(0, 3)
      .map((p) => ({ name: p.label, reports: p.reports })),
    hasSample: reports.some((r) => r.sample),
  };
}
