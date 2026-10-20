// 엑셀 업로드 열 정의 + 열 이름 자동 인식 (순수 함수)
// - 공백·괄호·구분 기호를 지우고 비교해 "제품 매출액(원)", "제품매출" 등을 같은 열로 본다
// - 머리글에 (천원)·(백만원)이 있으면 그 배수로 원 단위 환산
import type { Cell } from "@/shared/upload/read-table";

export type SheetKind = "annualTarget" | "monthly" | "unknown";

export const KIND_LABEL: Record<SheetKind, string> = {
  annualTarget: "연간목표",
  monthly: "월별실적",
  unknown: "인식 못함",
};

export type ColumnKey =
  | "year"
  | "month"
  | "revenueTarget"
  | "goodsPurchase"
  | "materialPurchase"
  | "operatingExpense"
  | "advertising"
  | "entertainment"
  | "otherExpense"
  | "productSales"
  | "goodsSales"
  | "serviceSales";

/** 양식 열 이름(표시·양식 다운로드) + 같은 열로 볼 이름 */
export const COLUMNS: Record<ColumnKey, { label: string; aliases: string[] }> =
  {
    year: {
      label: "연도",
      aliases: ["연도", "년도", "year", "기준연도", "회계연도", "년"],
    },
    month: { label: "월", aliases: ["월", "month", "기준월", "해당월"] },
    revenueTarget: {
      label: "목표매출액",
      aliases: [
        "목표매출액",
        "목표매출",
        "연간목표",
        "연간목표매출",
        "연간목표매출액",
        "매출목표",
        "매출목표액",
        "목표액",
        "목표",
      ],
    },
    goodsPurchase: { label: "상품매입액", aliases: ["상품매입액", "상품매입"] },
    materialPurchase: {
      label: "원재료매입액",
      aliases: [
        "원재료매입액",
        "원재료매입",
        "원자재매입",
        "원자재매입액",
        "재료매입액",
        "재료비",
      ],
    },
    operatingExpense: {
      label: "경비지출액",
      aliases: ["경비지출액", "경비지출", "경비", "경비액"],
    },
    advertising: {
      label: "광고선전비",
      aliases: ["광고선전비", "광고비", "광고선전"],
    },
    entertainment: { label: "접대비", aliases: ["접대비", "기업업무추진비"] },
    otherExpense: {
      label: "그외지출액",
      aliases: [
        "그외지출액",
        "그외지출",
        "기타지출",
        "기타지출액",
        "기타경비",
        "그외경비",
      ],
    },
    productSales: { label: "제품매출액", aliases: ["제품매출액", "제품매출"] },
    goodsSales: { label: "상품매출액", aliases: ["상품매출액", "상품매출"] },
    serviceSales: {
      label: "용역매출액",
      aliases: ["용역매출액", "용역매출", "서비스매출", "서비스매출액"],
    },
  };

/** 시트 종류별 열 순서 (미리보기·양식) */
export const KIND_COLUMNS: Record<
  Exclude<SheetKind, "unknown">,
  ColumnKey[]
> = {
  annualTarget: ["year", "revenueTarget"],
  monthly: [
    "year",
    "month",
    "goodsPurchase",
    "materialPurchase",
    "operatingExpense",
    "advertising",
    "entertainment",
    "otherExpense",
    "productSales",
    "goodsSales",
    "serviceSales",
  ],
};

/** 월별실적의 금액 열 (연도·월 제외) */
export type MonthlyAmountKey = Exclude<
  ColumnKey,
  "year" | "month" | "revenueTarget"
>;
export const MONTHLY_AMOUNT_KEYS = KIND_COLUMNS.monthly.slice(
  2,
) as MonthlyAmountKey[];
const SALES_KEYS: ColumnKey[] = ["productSales", "goodsSales", "serviceSales"];

/** 비교용 이름: 소문자, 공백·괄호·구분 기호·단위 제거 */
export function normalizeHeader(value: Cell): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(
      /\((원|천원|백만원)\)|\[(원|천원|백만원)\]|단위[:：]?\s*(원|천원|백만원)/g,
      "",
    )
    .replace(/[\s()（）[\]{}<>·ㆍ_\-./:：*]/g, "");
}

/** 머리글의 금액 단위 → 원 환산 배수 */
export function unitMultiplier(value: Cell): number {
  const text = String(value ?? "");
  if (/백만\s*원/.test(text)) return 1_000_000;
  if (/천\s*원/.test(text)) return 1_000;
  return 1;
}

const ALIAS_INDEX: { alias: string; key: ColumnKey }[] = (
  Object.entries(COLUMNS) as [ColumnKey, { aliases: string[] }][]
)
  .flatMap(([key, { aliases }]) => aliases.map((alias) => ({ alias, key })))
  .sort((a, b) => b.alias.length - a.alias.length);

/** 머리글 하나 → 열 (정확히 같으면 우선, 아니면 3글자 이상 이름을 포함하는 가장 긴 것) */
export function matchColumn(header: Cell): ColumnKey | null {
  const h = normalizeHeader(header);
  if (h === "") return null;
  const exact = ALIAS_INDEX.find((a) => a.alias === h);
  if (exact) return exact.key;
  const partial = ALIAS_INDEX.find(
    (a) => [...a.alias].length >= 3 && h.includes(a.alias),
  );
  return partial?.key ?? null;
}

export type HeaderMatch = {
  /** 머리글 행 (0부터) */
  headerRow: number;
  /** 열 → 시트의 열 번호 */
  columns: Partial<Record<ColumnKey, number>>;
  /** 열 → 원 환산 배수 */
  multipliers: Partial<Record<ColumnKey, number>>;
  kind: SheetKind;
};

/** 시트 앞 10행에서 머리글 행을 찾고 종류를 판별 (시트 이름도 참고) */
export function detectSheet(rows: Cell[][], sheetName: string): HeaderMatch {
  let best: HeaderMatch = {
    headerRow: -1,
    columns: {},
    multipliers: {},
    kind: "unknown",
  };
  let bestCount = 0;
  for (let r = 0; r < Math.min(rows.length, 10); r += 1) {
    const columns: Partial<Record<ColumnKey, number>> = {};
    const multipliers: Partial<Record<ColumnKey, number>> = {};
    rows[r].forEach((cell, c) => {
      const key = matchColumn(cell);
      if (key && columns[key] === undefined) {
        columns[key] = c;
        multipliers[key] = unitMultiplier(cell);
      }
    });
    const count = Object.keys(columns).length;
    if (count > bestCount) {
      bestCount = count;
      best = {
        headerRow: r,
        columns,
        multipliers,
        kind: kindOf(columns, sheetName),
      };
    }
  }
  return best;
}

function kindOf(
  columns: Partial<Record<ColumnKey, number>>,
  sheetName: string,
): SheetKind {
  const has = (k: ColumnKey) => columns[k] !== undefined;
  const name = normalizeHeader(sheetName);
  if (has("revenueTarget") && (has("year") || name.includes("목표"))) {
    // 월별 매출 열이 함께 있으면 월별실적으로 본다 (목표 열이 섞인 실적표)
    if (!(has("month") && SALES_KEYS.some(has))) return "annualTarget";
  }
  if (has("month") && MONTHLY_AMOUNT_KEYS.filter(has).length >= 1) {
    return "monthly";
  }
  return "unknown";
}
