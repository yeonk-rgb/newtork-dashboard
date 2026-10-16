// 지표 계산 설정 — 고객사 답변에 따라 바꾼다
import type { CostMode } from "./types";

export type MetricsSettings = {
  /**
   * 이익 계산 시 비용 범위 (docs/05-open-questions.md 3번 답변 전까지 임시)
   * - purchases: 상품·원재료 매입을 모두 비용으로 (이익 = 총매출 − 총지출)
   * - excludePurchases: 매입 제외, 경비 + 그 외 지출만 비용 (참고용)
   */
  costMode: CostMode;
  /** 수금 예정액을 보여줄 개월 수 */
  expectedCollectionMonths: number;
};

export const DEFAULT_METRICS_SETTINGS: MetricsSettings = {
  costMode: "purchases",
  expectedCollectionMonths: 6,
};
