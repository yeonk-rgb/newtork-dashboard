// 공통 마감 클래스 (docs/design-guide.md) — 화면마다 따로 적지 말고 이 상수를 쓴다
// 순수 문자열만 두어 서버·클라이언트 컴포넌트 어디서나 import 가능

/* ── 제목 위계: 페이지 제목 > 카드 제목 > 라벨 ── */
/** 페이지 제목 (h1): 24px Bold */
export const pageTitleClass =
  "text-2xl font-bold tracking-tight text-foreground";
/** 카드·대화상자 제목 (h2): 16px SemiBold */
export const cardTitleClass = "text-base font-semibold text-foreground";
/** 라벨·카드 안 소제목·표 머리글: 12px Medium 보조색 */
export const labelClass = "text-xs font-medium text-muted-foreground";

/* ── 버튼: 높이 40px, 라운드 10px. 기본 = 네이비 단색, 보조 = 흰 바탕 + 보더 ── */
const buttonBase =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50";
/** 기본 버튼 (저장·확정 등 주 동작) */
export const buttonPrimaryClass = `${buttonBase} bg-primary text-primary-foreground hover:bg-primary-800`;
/** 보조 버튼 (취소·다운로드 등) */
export const buttonSecondaryClass = `${buttonBase} border bg-card text-foreground hover:bg-primary-50`;
/** 위험 동작 보조 버튼 (삭제·비활성화) — 흰 바탕 + 보더 + 감소색 글자 */
export const buttonDangerClass = `${buttonBase} border bg-card text-destructive hover:bg-danger-soft`;
/** 위험 동작 확정 버튼 (확인창 안에서만) */
export const buttonDangerSolidClass = `${buttonBase} bg-destructive text-white hover:bg-danger-strong`;

/** 표 행 안의 작은 버튼 (높이 32px) — 표 줄 높이를 지키기 위해 표 안에서만 */
export const buttonCompactClass =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border bg-card px-3 text-xs font-medium whitespace-nowrap text-foreground transition-colors duration-150 outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50";
/** 아이콘만 있는 작은 버튼 (32px 정사각) */
export const iconButtonClass =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-30";

/* ── 배지·pill: 높이 24px, 글자 12px — 색만 바꿔서 쓴다 ── */
export const pillClass =
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap tabular-nums";

/** 바깥이 테두리인 작은 토글·필터 (pill 모양 버튼, 높이 32px) */
export const chipClass =
  "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium text-body transition-colors duration-150 outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-ring/40";
