// 지표 계산 입력·출력 타입 — DB(Prisma)와 무관한 순수 데이터
import type { Period, YearMonth } from "@/shared/period/period";

// ---------- 입력 ----------

export type OtherExpenseInput = {
  categoryId: string;
  name: string;
  sortOrder: number;
  /** 지출 항목 설정의 고정비/변동비 (null = 미분류) — 손익분기점 계산에 쓴다 */
  costType: "FIXED" | "VARIABLE" | null;
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
  /** 직원 수 (명, 없으면 null) — 인당 생산성 */
  headcount?: number | null;
};

/** 미수금 관리(건별) 한 건 — 2026-10-26부터 대시보드 기준이 아니라 건별 참고용 (미수금 관리 화면·건별 엑셀) */
export type ReceivableInput = {
  id: string;
  customerName: string;
  occurredOn: Date;
  amount: bigint;
  isCollected: boolean;
  collectedOn: Date | null;
  dueOn: Date | null;
  note?: string | null;
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

/** 손익분기점 계산의 비용 구분 */
export type CostClass = "FIXED" | "VARIABLE";

/** 계산 내역 한 줄 — 분류 근거: 적용 기준(설정 파일) / 항목 설정 / 미분류라 고정비로 */
export type BreakEvenItem = {
  key: string;
  label: string;
  amount: bigint;
  costClass: CostClass;
  basis: "settings" | "category" | "unclassified";
};

/**
 * 계산할 수 없는 이유
 * - no-data: 확정된 달 없음 / no-revenue: 매출 0원
 * - not-reachable: 공헌이익 ≤ 0 (변동비 ≥ 매출) / no-fixed-cost: 고정비 0원
 */
export type BreakEvenReason =
  "no-data" | "no-revenue" | "not-reachable" | "no-fixed-cost";

export type BreakEvenResult = {
  items: BreakEvenItem[];
  revenue: bigint;
  variableCost: bigint;
  fixedCost: bigint;
  /** 공헌이익 = 매출 − 변동비 */
  contribution: bigint;
  /** 공헌이익 ÷ 매출 (매출 0이면 null) */
  contributionRatio: number | null;
  /** 손익분기점 매출 = 고정비 × 매출 ÷ 공헌이익 (원 단위 올림) */
  bepRevenue: bigint | null;
  /** 달성률 = 공헌이익 ÷ 고정비 (= 매출 ÷ BEP 매출) */
  rate: number | null;
  /** 실제 매출 − BEP 매출 (음수 = BEP까지 남은 매출) */
  gap: bigint | null;
  reason: BreakEvenReason | null;
  /** 금액이 있는 미분류 그 외 지출 항목 수 (고정비로 계산함) */
  unclassifiedCount: number;
  /** 적용 기준 문구 (settings.ts APPLIED_BASIS) */
  appliedBasis: string[];
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
  /** 해당 연도 분기별 확정 매출 (분기별 목표 표용) */
  quarterActuals: [bigint, bigint, bigint, bigint] | null;
  /** 1~12월 월 목표 = 분기 목표 ÷ 3 자동 (나머지 원은 분기 마지막 달) — allocateMonthTargets */
  monthTargets: bigint[] | null;
  /** (월 보기만) 그 달 월 목표 대비 그 달 확정 매출 */
  month: (TargetProgress & { month: number }) | null;
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

// ---------- 미수금 (2026-10-26부터 채권·채무 외상매출금 기준, 05-22) ----------

/** 외상매출금 상태 — 원본 「경영지원 관리」 그룹 (장기미수 / 당월수금완료 / 당월수금예정) */
export type ArStatus = "LONG_OVERDUE" | "COLLECTED" | "SCHEDULED";

/** 채권·채무 관리 외상매출금 한 행 (숨긴 행 제외) */
export type ArEntryInput = {
  id: string;
  year: number;
  month: number;
  status: ArStatus;
  partnerName: string;
  amount: bigint;
  /** 수금 예정일 */
  dueOn: Date | null;
  /** 수금 완료일 (당월수금완료) */
  settledOn: Date | null;
  note: string | null;
};

export type AmountCount = { amount: bigint; count: number };

/** 기준월 미수 행 (장기미수 + 당월수금예정, 금액 큰 순) */
export type ReceivableItem = {
  id: string;
  customerName: string;
  amount: bigint;
  status: "LONG_OVERDUE" | "SCHEDULED";
  dueOn: Date | null;
  note: string | null;
  /** 당월수금예정인데 수금 예정일이 기준일보다 앞섬 */
  isOverdue: boolean;
};

/**
 * 대시보드·리포트 미수금 — 기준월 외상매출금의 장기미수 + 당월수금예정 (당월수금완료는 미수가 아님)
 * 기준월 = 기간 안에서 오늘 이전, 채권·채무 외상매출금 입력이 있는 마지막 달 (없으면 null → "입력 없음")
 */
export type ReceivableResult = {
  /** 기준일 = min(기준월 말일, 오늘). 기준월이 없으면 min(기간 말일, 오늘) */
  asOf: Date;
  month: YearMonth | null;
  /** 기준월이 이번 달 (작성 중일 수 있음) */
  isCurrentMonth: boolean;
  /** 미수 = 장기미수 + 당월수금예정 */
  total: bigint;
  /** 미수 행 수 */
  count: number;
  /** 미수가 있는 거래처 수 */
  customerCount: number;
  longOverdue: AmountCount;
  scheduled: AmountCount;
  /** 기준월 당월수금완료 (그 달에 받은 돈 — 미수에 넣지 않음) */
  collected: AmountCount;
  items: ReceivableItem[];
  /** 거래처별 미수 (금액 큰 순) — longOverdue = 그중 장기미수 */
  byCustomer: {
    customerName: string;
    amount: bigint;
    count: number;
    longOverdue: bigint;
  }[];
  /** 당월수금예정 행의 수금 예정일 */
  expected: {
    /** 예정일이 기준일보다 앞섬 */
    overdue: AmountCount;
    /** 기준월부터 N개월 (예정일 기준) */
    months: (YearMonth & AmountCount)[];
    later: AmountCount;
    noDueDate: AmountCount;
  };
};

// ---------- 미수금 관리 (건별, 참고용) ----------

export type AgingBucket = "0-30" | "31-60" | "61-90" | "90+";

/** 기준일 시점 미수 건 (건별 — 미수금 관리 건별 엑셀) */
export type ItemReceivable = {
  id: string;
  customerName: string;
  occurredOn: Date;
  amount: bigint;
  dueOn: Date | null;
  note: string | null;
  /** 발생일부터 기준일까지 경과일 */
  ageDays: number;
  bucket: AgingBucket;
  /** 수금 예정일이 기준일보다 앞섬 */
  isOverdue: boolean;
};

/** 미수금 관리(건별) 기준일 잔액 — 건별 참고 엑셀용 (대시보드는 ReceivableResult) */
export type ItemReceivableResult = {
  asOf: Date;
  total: bigint;
  count: number;
  /** 미수 건 전체 (금액 큰 순) */
  items: ItemReceivable[];
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
  breakEven: BreakEvenResult;
};

export type Comparison = {
  period: Period;
  label: string;
  isPartial: boolean;
  revenue: Change;
  expense: Change;
  profit: Change;
  /** 이익 금액 차이 (현재 − 비교, 원). 이익이 작거나 적자이면 증감률이 크게 튀어 대시보드는 금액 차이로 보여 준다 */
  profitDiff: AmountDiff;
  /** 이익률 차이 (%p, 0.05 = +5%p). 비율끼리라 증감률 대신 차이로 비교 */
  margin: MarginChange;
  /**
   * 같은 월끼리 비교한 범위. 현재 기간에 확정 안 된 달이 있으면
   * 현재의 확정 월과 같은 순서의 달만 비교 기간에서 뽑아 비교한다 (예: 2026 1~8월 vs 2025 1~8월).
   * 모든 월이 확정이면 null (기간 전체 비교)
   */
  aligned: { current: YearMonth[]; base: YearMonth[] } | null;
  /** 항목별 증감률 (key = AmountShare.key) — 상세 표용 */
  revenueItems: Record<string, Change>;
  expenseItems: Record<string, Change>;
};

export type AmountDiff = {
  diff: bigint | null;
  reason?: "no-current-data" | "no-data";
};

export type MarginChange = {
  diff: number | null;
  reason?: "no-current-data" | "no-data" | "no-margin";
};

/**
 * 인당 생산성 — 확정된 달 합계 ÷ 직원 수 (원 단위 반올림)
 * reason: no-headcount = 그 해 직원 수 미입력 / no-data = 확정된 달 없음
 */
export type ProductivityResult = {
  headcount: number | null;
  revenuePerHead: bigint | null;
  profitPerHead: bigint | null;
  reason: "no-headcount" | "no-data" | null;
};

export type ManagementSummary = PeriodCore & {
  targets: TargetResult;
  /** 목표 미설정이면 null */
  annualProgress: AnnualProgress | null;
  changes: { previous: Comparison; lastYear: Comparison };
  receivables: ReceivableResult;
  productivity: ProductivityResult;
};
