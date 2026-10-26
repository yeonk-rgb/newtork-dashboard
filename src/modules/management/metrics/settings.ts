// 지표 계산 설정 — 2026-10-26 자료 기반 결정 (docs/05-open-questions.md "자료 기반 결정")
// 담당자가 다른 기준을 원하면 이 파일만 바꾼다 (값 + 화면 "적용 기준" 문구를 함께)
import type { CostClass, CostMode } from "./types";

/**
 * 화면 "적용 기준"에 한 줄씩 보여 줄 문구 — BEP 카드 [계산 기준]·계산 내역 표·월별 리포트 각주가 이 목록을 읽는다
 * 아래 설정값을 바꾸면 해당 줄도 함께 고친다
 */
export const APPLIED_BASIS: string[] = [
  "매출·매입·경비(월간 입력)는 공급가액(부가세 제외) 기준입니다",
  "미수금·외상매입금·미지급비용은 실제 주고받는 금액(부가세 포함) 그대로입니다",
  "상품·원재료 매입액을 그달의 원가로 보고 변동비로 계산합니다",
  "경비 지출과 그 외 지출은 고정비로 계산합니다 (항목별 구분은 목표·항목 설정에서 바꿀 수 있음)",
  "회계연도는 1~12월, 매출은 세금계산서 발행 기준입니다",
];

/**
 * 손익분기점(BEP) 분류 — 매입 = 변동비, 경비·그 외 지출 = 고정비 (회계 관행, 05-3·35·36)
 * (그 외 지출 항목은 목표·항목 설정 화면의 고정비/변동비 선택을 따른다)
 */
export type BreakEvenSettings = {
  /** 상품·원재료 매입 (05-3: 매입액 = 원가) */
  purchases: CostClass;
  /** 월간 입력의 경비 지출 (05-36) */
  operatingExpense: CostClass;
  /** 그 외 지출 중 고정비/변동비를 고르지 않은 항목 (05-35) */
  unclassifiedOther: CostClass;
  /** 화면 [계산 기준]에 한 줄씩 보여 줄 적용 기준 (= APPLIED_BASIS) */
  appliedBasis: string[];
};

export type MetricsSettings = {
  /**
   * 이익 계산 시 비용 범위 (05-3 매입액 = 원가로 결정)
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
    appliedBasis: APPLIED_BASIS,
  },
};
