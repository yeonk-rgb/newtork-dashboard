// 지표 계산 입력·출력 타입 — DB(Prisma)와 무관한 순수 데이터
import type { Period, YearMonth } from "@/shared/period/period";

// ---------- 입력 ----------

export type OtherExpenseInput = {
  categoryId: string;
  name: string;
  sortOrder: number;
  amount: bigint;
};

export type FinanceMonth = YearMonth & {
  status: "DRAFT" | "CONFIRMED";
  productSales: bigint;
  goodsSales: bigint;
  serviceSales: bigint;
  goodsPurchase: bigint;
  materialPurchase: bigint;
  operatingExpense: bigint;
  otherExpenses: OtherExpenseInput[];
};

export type AnnualTargetInput = {
  year: number;
  revenueTarget: bigint;
  /** 1~4분기 목표 (null = 비어 있음) */
  quarterTargets: [bigint | null, bigint | null, bigint | null, bigint | null];
};

export type ReceivableInput = {
  id: string;
  customerName: string;
  occurredOn: Date;
  amount: bigint;
  isCollected: boolean;
  collectedOn: Date | null;
  dueOn: Date | null;
};

// ---------- 출력 공통 ----------

/** 금액 + 비율(0~1, 분모가 0이면 null) */
export type AmountShare = {
  key: string;
  label: string;
  amount: bigint;
  ratio: number | null;
};

export type Change = {
  /** (현재 − 비교) ÷ |비교|. 계산 불가면 null */
  rate: number | null;
  /**
   * no-current-data: 현재 기간에 확정 데이터 없음 (−100%로 보이지 않게)
   * no-data: 비교 기간에 확정 데이터 없음 / zero-base: 비교값이 0
   */
  reason?: "no-current-data" | "no-data" | "zero-base";
};

export type UnconfirmedMonth = YearMonth & { reason: "DRAFT" | "MISSING" };

export type Confirmation = {
  /** 집계에 쓴 확정 월 */
  confirmedMonths: YearMonth[];
  /** 마감됐어야 하는데 확정되지 않은 월 (화면 안내용) */
  unconfirmedMonths: UnconfirmedMonth[];
  /** 아직 마감 전인 월 (이번 달·미래) — 미확정으로 보지 않음 */
  pendingMonths: YearMonth[];
  /** 미확정 월이 있어 일부만 집계됨 */
  isPartial: boolean;
  /** 확정 월이 하나라도 있음 */
  hasData: boolean;
};

export type RevenueResult = { total: bigint; items: AmountShare[] };

export type ExpenseResult = {
  total: bigint;
  /** 상품매입, 원재료매입, 경비, 그 외 지출(합계) */
  items: AmountShare[];
  /** 그 외 지출 항목별 (비율은 총지출 대비) */
  otherItems: AmountShare[];
};

export type CostMode = "purchases" | "excludePurchases";

export type ProfitResult = {
  costMode: CostMode;
  /** 이익 계산에 쓴 비용 */
  cost: bigint;
  profit: bigint;
  /** 이익 ÷ 총매출 */
  margin: number | null;
};

export type TargetProgress = {
  target: bigint;
  actual: bigint;
  rate: number | null;
};

export type QuarterTargets = {
  quarters: [bigint, bigint, bigint, bigint];
  /** input: 직접 입력 / allocated: 규칙으로 배분 */
  sources: ("input" | "allocated")[];
  warning?: "QUARTER_SUM_EXCEEDS_ANNUAL" | "QUARTER_SUM_MISMATCH";
};

export type TargetResult = {
  /** 목표 미설정이면 null */
  annual: TargetProgress | null;
  /**
   * 기간별 목표
   * - quarter: 분기 목표 대비 분기 매출
   * - quarter-progress: (월 보기) 분기 목표 대비 분기 첫 달~해당 월 누적
   * - annual: (연간 보기) annual 과 같음
   * - ytd-prorated: (YTD 보기) 연간 × 경과월/12 대비 누적
   */
  period: (TargetProgress & { kind: TargetKind }) | null;
  quarterTargets: QuarterTargets | null;
};

/**
 * 연간 목표 도넛용: 선택한 기간과 무관하게 "그 해 연간 목표 대비 확정 누적 실적"
 * (docs/06-management-checklist.md 해석)
 */
export type AnnualProgress = {
  year: number;
  target: bigint;
  /** 그 해 확정된 모든 달의 매출 합 */
  actual: bigint;
  /** 목표 − 실적 (초과 달성이면 0) */
  remaining: bigint;
  rate: number | null;
  /**
   * 진도 기준 월 = 확정된 마지막 달 (실적과 같은 기준으로 비교하기 위해).
   * 확정된 달이 없으면 0
   */
  basisMonth: number;
  /** 연간 경과율 = 기준 월 ÷ 12 (진도 기준선 눈금) */
  elapsedRatio: number;
  /** 실적에 포함된 확정 월 */
  confirmedMonths: number[];
  /** 기준 월 이후 이미 마감됐지만 미확정인 달 → "진도 비교에서 제외" 안내 */
  excludedMonths: number[];
  /** 기준 월 이전인데 미확정인 달 → 실적에서 빠져 있음 안내 */
  gapMonths: number[];
};

export type TargetKind =
  "quarter" | "quarter-progress" | "annual" | "ytd-prorated";

// ---------- 미수금 ----------

export type AgingBucket = "0-30" | "31-60" | "61-90" | "90+";

export type ReceivableResult = {
  asOf: Date;
  total: bigint;
  count: number;
  byCustomer: { customerName: string; amount: bigint; count: number }[];
  aging: { bucket: AgingBucket; amount: bigint; count: number }[];
  expected: {
    /** 수금 예정일이 이미 지남 */
    overdue: { amount: bigint; count: number };
    /** 기준일이 속한 달부터 6개월 */
    months: (YearMonth & { amount: bigint; count: number })[];
    /** 6개월 이후 */
    later: { amount: bigint; count: number };
    /** 수금 예정일 없음 */
    noDueDate: { amount: bigint; count: number };
  };
};

// ---------- 종합 ----------

export type PeriodCore = {
  period: Period;
  label: string;
  confirmation: Confirmation;
  revenue: RevenueResult;
  expenses: ExpenseResult;
  profit: ProfitResult;
};

export type Comparison = {
  period: Period;
  label: string;
  isPartial: boolean;
  revenue: Change;
  expense: Change;
  profit: Change;
  /** 이익률 차이 (%p, 0.05 = +5%p). 비율끼리라 증감률 대신 차이로 비교 */
  margin: MarginChange;
};

export type MarginChange = {
  diff: number | null;
  reason?: "no-current-data" | "no-data" | "no-margin";
};

export type ManagementSummary = PeriodCore & {
  targets: TargetResult;
  /** 목표 미설정이면 null */
  annualProgress: AnnualProgress | null;
  changes: { previous: Comparison; lastYear: Comparison };
  receivables: ReceivableResult;
};
