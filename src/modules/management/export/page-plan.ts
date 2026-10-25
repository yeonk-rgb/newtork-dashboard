// 블록 단위 쪽 나눔 (순수 함수) — 월별 리포트처럼 긴 시트를 인쇄할 때 블록 중간에서 쪽이 끊기지 않게 (2026-10-26)
// Excel 은 "너비 1페이지에 맞춤"이면 수동 쪽 나눔을 무시한다(2026-10-26 Excel 로 확인) → 맞춤 대신
// "너비가 1페이지에 들어가는 고정 배율"을 열 너비로 계산하고, 블록 경계에 쪽 나눔을 넣는다

/**
 * Excel 열 너비(글자 수) → 픽셀. Windows 기본(Calibri 11)은 숫자 폭 7px 이지만 Mac Excel 인쇄에서는 약 1.1배 넓게 그려져서
 * (2026-10-26 PDF 로 측정) 넘치지 않게 숫자 폭 8px 로 계산한다
 */
export const DIGIT_PX = 8;
export function columnPixels(width: number, digit = DIGIT_PX): number {
  return Math.trunc(((256 * width + Math.trunc(128 / digit)) / 256) * digit);
}

/** 글자 폭(숫자 폭 단위): 한글·전각 ≈ 1.9, 나머지 1 — H열 메모가 I열까지 들어가는지 볼 때 */
export function textUnits(text: string): number {
  let n = 0;
  for (const ch of text) n += /[\u1100-\uFFFF]/.test(ch) ? 1.9 : 1;
  return n;
}

/** A4 (pt) */
const A4 = { width: 595.28, height: 841.89 };

export type PagePlanInput = {
  /** 인쇄 범위 열 너비 (숨긴 열은 0) */
  columnWidths: number[];
  /** 행 높이 (pt, index 0 = 1행) */
  rowHeights: number[];
  /** 쪽 나눔 단위 (1부터 행 번호) */
  blocks: { first: number; last: number }[];
  orientation: "portrait" | "landscape";
  /** 여백 (인치) */
  margins: { left: number; right: number; top: number; bottom: number };
};

export type PagePlan = {
  /** 배율 (%) — 인쇄 범위 너비가 1페이지에 들어가는 가장 큰 정수, 100 이하 */
  scale: number;
  /** 쪽 나눔 행 (이 행 아래에서 다음 쪽) */
  breaks: number[];
};

export function planPages(input: PagePlanInput): PagePlan {
  const paper =
    input.orientation === "landscape"
      ? { width: A4.height, height: A4.width }
      : A4;
  const printableWidth =
    paper.width - (input.margins.left + input.margins.right) * 72;
  const printableHeight =
    paper.height - (input.margins.top + input.margins.bottom) * 72;
  const contentWidth =
    input.columnWidths.reduce((n, w) => n + (w > 0 ? columnPixels(w) : 0), 0) *
    0.75;
  const scale = Math.max(
    10,
    Math.min(100, Math.floor((printableWidth / contentWidth) * 100)),
  );
  // 한 쪽에 들어가는 행 높이 합 (배율 전 pt)
  const capacity = printableHeight / (scale / 100);
  const height = (from: number, to: number) => {
    let h = 0;
    for (let r = from; r <= to; r++) h += input.rowHeights[r - 1] ?? 15;
    return h;
  };

  const breaks: number[] = [];
  let pageStart = 1;
  for (const block of input.blocks) {
    // 이 블록 끝까지 지금 쪽에 들어가는가 (블록 앞 빈 행 포함)
    if (height(pageStart, block.last) > capacity && block.first > pageStart) {
      // 블록 바로 앞(빈 행 포함)에서 나눈다 — 빈 행은 앞 쪽 끝에 남긴다
      const breakAt = block.first - 1;
      breaks.push(breakAt);
      pageStart = breakAt + 1;
    }
  }
  return { scale, breaks };
}
