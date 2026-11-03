// 경영 대시보드(메인) 화면 이름 표 — 이 파일 한 곳에서 바꾼다 (2026-10-25 담당자 요청 반영)
// 화면 표시 층에서만 쓰는 이름이다. metrics 의 이름표(AmountShare.label)는 그대로 둔다
// → AI 분석 입력(buildAiInput)과 해시가 바뀌지 않아 기존 분석에 "데이터가 변경되어…" 안내가 뜨지 않는다
import { TERMS } from "../../terms";

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
  /** 미수금 = 경영지원 관리 외상매출금 (장기 미수금 + 당월 수금예정) — 2026-10-26 결정 05-22 */
  receivablesBasis: `${TERMS.ledger} ${TERMS.arBasis}`,
  receivablesEmpty: `이 기간에 ${TERMS.ledger} 입력 없음`,
  receivablesInProgress: "이번 달 작성 중",
  longOverdue: TERMS.longOverdue,
  scheduled: TERMS.scheduled,
  collected: TERMS.collected,
  areas: {
    status: "분기별 목표 달성 현황",
    trend: "추이 및 분석",
    teams: "팀별 현황",
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
  /** 생산팀 데이터에 금액이 없어 확정 출고 수량 기준 (2026-11-03, 05-10 갱신) */
  industry: "산업 분야별 판매량",
  series: "제품별 판매량",
  /** 제품별 카드 안 작은 글씨 — 모델명은 제조내역 엑셀 C열 원본 값 (생산팀 specs/07 Q7) */
  seriesBasis: "모델명(제조내역 C열) 기준 · 확정 출고 수량",
  /** 산업 분야별 카드 안 작은 글씨 — 처음 요구사항의 7개 분류, 수주번호별 사업구분 (05-6) */
  industryBasis:
    "7개 분류(상하수도·발전소·가스·오일·석유·민간 플랜트·기타) · 확정 출고 수량",
  shareEmpty: "이 기간에 확정 출고 수량이 없습니다.",
  sampleBadge: "샘플 데이터",
  sampleNote: "합계는 이 기간 확정 매출, 비중은 가상(생산팀 데이터 연동 전)",
  sampleProductionNote: "시연용 가짜 데이터 포함 (실제 데이터 넣기 전에 삭제)",
  team: {
    production: "생산팀",
    service: "서비스팀",
  },
} as const;

/** 비교 줄 이름: 전월 / 전분기 / 전년 + 전년 동기 */
export const COMPARISON_LABELS = {
  previous: { month: "전월", quarter: "전분기", year: "전년", ytd: "전년" },
  lastYear: "전년 동기",
} as const;
