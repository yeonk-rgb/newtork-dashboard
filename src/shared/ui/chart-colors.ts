// 차트 색 — dataviz 검증 팔레트 (라이트 모드, 카드 배경 #ffffff 기준).
// 규칙: 같은 항목은 모든 차트에서 같은 색, 색은 순위가 아니라 항목을 따른다, 순서를 돌려쓰지 않는다.
// 검증: validate_palette.js 로 원형 그래프의 마지막↔첫 조각까지 포함해 확인
//  - 산업분야 7색(파랑·주황·청록·노랑·자홍·녹색·빨강): PASS (녹색↔빨강 CVD ΔE 7.2 → 조각 간격 2px + 이름 목록·표 보기로 보완)
//  - 보라(slot 7)는 파랑과 맞닿으면 구분 불가(FAIL)라 원형 그래프에 쓰지 않는다
//  - 청록·노랑·자홍은 흰 배경 대비 3:1 미만 → 값은 항상 글자 목록/표로도 보여준다

export const PALETTE = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
  magenta: "#e87ba4",
  green: "#008300",
  violet: "#6250d6",
  red: "#e34948",
} as const;

/** 목표 도넛(meter): 채움은 파랑, 트랙은 같은 파랑의 옅은 단계 */
export const METER = { fill: PALETTE.blue, track: "#cde2fb" } as const;

/** 조각 사이 간격 = 카드 배경색 */
export const CHART_SURFACE = "#ffffff";

/** 산업분야 (docs/interface-production.md 코드) — 원형 그래프 조각 순서도 이 순서로 고정 */
export const INDUSTRY_COLORS: Record<string, string> = {
  WATER: PALETTE.blue,
  POWER: PALETTE.orange,
  GAS: PALETTE.aqua,
  OIL: PALETTE.yellow,
  PETROLEUM: PALETTE.magenta,
  PRIVATE_PLANT: PALETTE.green,
  ETC: PALETTE.red,
};

/** 제품 시리즈 (목업 코드 기준 — 실제 시리즈 목록은 생산팀과 합의 후 갱신) */
export const SERIES_COLORS: Record<string, string> = {
  SERIES_A: PALETTE.blue,
  SERIES_B: PALETTE.orange,
  SERIES_C: PALETTE.aqua,
  SERIES_D: PALETTE.yellow,
};

/** 매출 구성 (PR ③ 추이 차트에서 사용) */
export const REVENUE_COLORS: Record<string, string> = {
  product: PALETTE.aqua,
  goods: PALETTE.yellow,
  service: PALETTE.magenta,
};

/** 월별 매출·지출 (PR ③) */
export const FLOW_COLORS = {
  revenue: PALETTE.blue,
  expense: PALETTE.orange,
} as const;
