// 서비스팀 → 경영지원팀 연동 형식 (docs/interface-production.md 6번, 2026-11-03 통합 1단계)
import type { Period } from "@/shared/period/period";

/** 메인 "팀별 현황" 서비스 카드 — 출장 시작일 기준, 출장보고서 1건 = 출장 1건 */
export type ServiceOverview = {
  trips: number;
  paid: number;
  free: number;
  /** 비용청구 유무 미입력 */
  billingUnset: number;
  /** 유상 ÷ (유상 + 무상), 미입력 제외. 둘 다 0이면 null */
  paidRatio: number | null;
  /** 수리 제품 대수 (수량을 입력한 제품만) */
  productQuantity: number;
  hasSample: boolean;
};

export type ServiceOverviewFn = (period: Period) => Promise<ServiceOverview>;
