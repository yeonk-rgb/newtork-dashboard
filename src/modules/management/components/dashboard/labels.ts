// 경영 대시보드(메인) 화면 이름 표 — 이 파일 한 곳에서 바꾼다 (2026-10-25 담당자 요청 반영)
// 화면 표시 층에서만 쓰는 이름이다. metrics 의 이름표(AmountShare.label)는 그대로 둔다
// → AI 분석 입력(buildAiInput)과 해시가 바뀌지 않아 기존 분석에 "데이터가 변경되어…" 안내가 뜨지 않는다
export const DASHBOARD_LABELS = {
  kpi: {
    revenue: "매출",
    expense: "지출",
    profit: "추정 이익",
    receivables: "미수금",
  },
  /** 추정 이익 카드 작은 안내 — 비용 기준(costMode)별 */
  profitNote: {
    purchases: "적용 기준: 매입액 = 원가 · 공급가액",
    excludePurchases: "매입을 빼고 계산한 참고 기준",
  },
  expenseNote: "상품 매입 + 원재료 매입 + 경비 + 기타",
  receivablesBasis: "미수금 관리 기준",
  areas: {
    status: "분기별 목표 달성 현황",
    trend: "추이 및 분석",
    ai: "AI 분석",
  },
  targetCard: "목표매출 달성률",
  monthTargetNote: "월 목표 = 분기 목표 ÷ 3 (자동)",
  revenueMix: "매출 구성",
  expenseMix: "지출 구성",
  /** 매출 구성 조각 (metrics key → 화면 이름) */
  revenueSlices: { product: "제품", goods: "상품", service: "용역" },
  /** 지출 구성 조각 4칸 (담당자 요청 그대로) */
  expenseSlices: {
    goodsPurchase: "상품 매입",
    materialPurchase: "원재료 매입",
    operatingExpense: "경비",
    otherExpense: "기타",
  },
  /** "기타" 조각 이름 옆 작은 글씨 */
  otherExpenseHint: "(광고선전비·접대비 등)",
  otherExpenseToggle: "항목별 보기",
  trendChart: "매출·지출 추이",
  industry: "산업 분야별 매출",
  series: "제품별 매출",
  /** 제품별 매출 카드 안 작은 글씨 — 기준은 처음 요구사항대로 제품 시리즈 */
  seriesBasis: "제품 시리즈 기준 · 금액 기준",
  /** 산업 분야별 매출 카드 안 작은 글씨 — 처음 요구사항의 7개 분류, 비중은 금액 기준 (05-6·10) */
  industryBasis:
    "7개 분류(상하수도·발전소·가스·오일·석유·민간 플랜트·기타) · 금액 기준",
  sampleBadge: "샘플 데이터",
  sampleNote: "합계는 이 기간 확정 매출, 비중은 가상(생산팀 데이터 연동 전)",
} as const;

/** 비교 줄 이름: 전월 / 전분기 / 전년 + 전년 동기 */
export const COMPARISON_LABELS = {
  previous: { month: "전월", quarter: "전분기", year: "전년", ytd: "전년" },
  lastYear: "전년 동기",
} as const;
