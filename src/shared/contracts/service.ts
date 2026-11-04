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
  /** 출장이 가장 많은 지역 (시·군·구 또는 시·도만 아는 것, 미지정 제외) — 서비스 대시보드 지도와 같은 집계 */
  topRegion: { label: string; trips: number; ratio: number } | null;
  /** 지역 미지정 출장 수 */
  regionUnassigned: number;
  /** 교체 부품 상위 3 (부품을 쓴 보고서 수) — 서비스 대시보드 교체 부품 순위와 같은 집계 */
  topParts: { name: string; reports: number }[];
  hasSample: boolean;
};

export type ServiceOverviewFn = (period: Period) => Promise<ServiceOverview>;
