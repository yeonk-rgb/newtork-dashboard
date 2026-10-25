// 지표 계산 설정 — 고객사 답변에 따라 바꾼다
import type { CostClass, CostMode } from "./types";

/**
 * 손익분기점(BEP) 분류·임시 기준 — 고객사 답이 오면 이 값만 바꾼다
 * (그 외 지출 항목은 목표·항목 설정 화면의 고정비/변동비 선택을 따른다)
 */
export type BreakEvenSettings = {
  /** 상품·원재료 매입 (05-3·정리본 ④-3: 매입액 = 원가) */
  purchases: CostClass;
  /** 월간 입력의 경비 지출 (05-36·정리본 ①-2: 인건비 포함 여부) */
  operatingExpense: CostClass;
  /** 그 외 지출 중 고정비/변동비를 고르지 않은 항목 (05-35) — 고정비면 BEP 매출이 높게 나와 보수적 */
  unclassifiedOther: CostClass;
  /**
   * 화면 [계산 기준]에 한 줄씩 보여 줄 임시 기준 — 비어 있으면 "임시 기준" 배지도 사라진다
   * 답이 오면 해당 줄을 지우거나 확정 문구로 바꾼다
   */
  provisionalNotes: string[];
};

export type MetricsSettings = {
  /**
   * 이익 계산 시 비용 범위 (docs/05-open-questions.md 3번 답변 전까지 임시)
   * - purchases: 상품·원재료 매입을 모두 비용으로 (이익 = 총매출 − 총지출)
   * - excludePurchases: 매입 제외, 경비 + 그 외 지출만 비용 (참고용)
   * 손익분기점도 같은 비용 범위를 쓴다 (흑자·적자 판정이 이익 구조와 항상 같게)
   */
  costMode: CostMode;
  /** 수금 예정액을 보여줄 개월 수 */
  expectedCollectionMonths: number;
  breakEven: BreakEvenSettings;
};

export const DEFAULT_METRICS_SETTINGS: MetricsSettings = {
  costMode: "purchases",
  expectedCollectionMonths: 6,
  breakEven: {
    purchases: "VARIABLE",
    operatingExpense: "FIXED",
    unclassifiedOther: "FIXED",
    provisionalNotes: [
      "상품·원재료 매입액을 그달의 원가로 보고 변동비로 계산합니다 (확인 중 ④-3)",
      "경비 지출은 고정비로 계산합니다 — 인건비 포함 여부 확인 중 (①-2)",
      "금액은 입력한 그대로 씁니다 — 부가세 포함 여부 확인 중 (④-1)",
      "채권·채무 관리 총액은 연결하지 않고 월간 입력 값만 씁니다 (①-2)",
    ],
  },
};
