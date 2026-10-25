// 차트 색 — 딥 네이비·코퍼 브랜드에 맞춘 저채도 범주 팔레트 (라이트 모드, 카드 배경 #ffffff 기준).
// 규칙: 같은 항목은 모든 차트에서 같은 색, 색은 순위가 아니라 항목을 따른다, 순서를 돌려쓰지 않는다.
// 검증(dataviz validate_palette.js, 2026-10-21): 원형 그래프는 마지막↔첫 조각도 맞닿으므로 그 쌍까지 확인
//  - 7색 인접 쌍(마지막↔첫 포함): PASS — 색각 이상 ΔE 최소 11.4, 일반 시각 ΔE 최소 17.5
//  - 저채도 요청이라 "채도 하한" 검사는 FAIL(회색빛으로 읽힘), 네이비는 명도 범위 밖(어두움) — 인접 구분은 통과.
//    그래서 값은 항상 이름·%·금액 글자 목록과 "표로 보기"로도 보여준다 (세이지·샌드·슬레이트는 흰 배경 대비 3:1 미만)
//  - 조각 순서는 위 검증 순서로 고정 (바꾸면 다시 검증)

export const PALETTE = {
  navy: "#1f3a5f",
  copper: "#b8612e",
  sage: "#86a382",
  mauve: "#86607e",
  sand: "#cbb27a",
  steel: "#5a83b0",
  /** 기타·미분류 (슬레이트, 중립) */
  slate: "#bcc1c8",
} as const;

/** 목표 도넛(meter): 채움은 네이비, 트랙은 네이비의 옅은 단계(primary-100), 초과분은 코퍼 */
export type MeterColors = { fill: string; track: string; over: string };
export const METER: MeterColors = {
  fill: PALETTE.navy,
  track: "#d5deea",
  over: PALETTE.copper,
};
/** 강조 카드(코퍼 바탕) 위의 meter — 채움 흰색, 트랙은 반투명 흰색, 초과분은 진한 네이비 */
export const METER_ON_ACCENT: MeterColors = {
  fill: "#ffffff",
  track: "rgba(255, 255, 255, 0.3)",
  over: "#172c48",
};

/** 조각 사이 간격 = 카드 배경색 */
export const CHART_SURFACE = "#ffffff";
/** 강조 카드 배경의 가운데 색 (#AD5A2A→코퍼 600 아주 옅은 그라데이션의 중간, globals.css --emphasis-*) */
export const ACCENT_SURFACE = "#a45527";

/** 축·격자·보조 선 (글자 토큰과 같은 따뜻한 회색 계열) */
export const CHART_INK = "#4a4f57";
export const CHART_GRID = "#ebe9e4";

/** 산업분야 (docs/interface-production.md 코드) — 원형 그래프 조각 순서도 이 순서로 고정 */
export const INDUSTRY_COLORS: Record<string, string> = {
  WATER: PALETTE.navy,
  POWER: PALETTE.copper,
  GAS: PALETTE.sage,
  OIL: PALETTE.mauve,
  PETROLEUM: PALETTE.sand,
  PRIVATE_PLANT: PALETTE.steel,
  ETC: PALETTE.slate,
};

/** 제품 시리즈 (목업 코드 기준 — 실제 시리즈 목록은 생산팀과 합의 후 갱신) */
export const SERIES_COLORS: Record<string, string> = {
  SERIES_A: PALETTE.navy,
  SERIES_B: PALETTE.copper,
  SERIES_C: PALETTE.sage,
  SERIES_D: PALETTE.mauve,
};

/** 매출 구성: 제품·상품·용역 */
export const REVENUE_COLORS: Record<string, string> = {
  product: PALETTE.navy,
  goods: PALETTE.copper,
  service: PALETTE.sage,
};

/**
 * 지출 구성: 상품 매입·원재료 매입·경비·기타 (2026-10-25 메인 재구성)
 * 원형이라 기타(마지막)가 상품 매입(첫째)과 맞닿음 → 코퍼↔모브를 피해 기타는 세이지. 화면 적용(대시보드 PR 2) 때 색 대비 다시 검증
 */
export const EXPENSE_COLORS: Record<string, string> = {
  goodsPurchase: PALETTE.copper,
  materialPurchase: PALETTE.sand,
  operatingExpense: PALETTE.steel,
  otherExpense: PALETTE.sage,
};

/** 이익 구조: 매입·경비·이익 (코퍼↔모브가 맞닿으면 구분이 약해 경비는 샌드) */
export const PROFIT_COLORS = {
  purchase: PALETTE.copper,
  operating: PALETTE.sand,
  profit: PALETTE.navy,
} as const;

/**
 * 미수금 경과 구간 — 순서가 있는 값이라 코퍼 한 색의 밝음→어두움 단계 (ordinal 검증 PASS)
 * 가장 밝은 단계는 흰 카드에서 보이도록 #DDA78B (요청값 #F3DCCB 는 대비 1.29:1 로 조각이 거의 안 보임)
 */
export const AGING_COLORS = {
  "0-30": "#dda78b",
  "31-60": "#c98059",
  "61-90": "#b8612e",
  "90+": "#9a4f24",
} as const;

/** 월별 매출·지출: 매출 = 네이비, 지출 = 코퍼. 선택 기간 밖의 달은 연한 단계 (연한 두 색끼리도 구분 PASS: ΔE 16.5) */
export const FLOW_COLORS = {
  revenue: PALETTE.navy,
  expense: PALETTE.copper,
  revenueSoft: "#d5deea",
  expenseSoft: "#d89e80",
} as const;
