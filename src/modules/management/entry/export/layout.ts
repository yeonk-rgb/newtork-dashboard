// 월간 입력 엑셀 다운로드 — 시트 한 장의 행 배치 (순수 함수, exceljs 모름)
// 원본 양식(경영지원_관리.xlsx)과 같은 쌓기: 매입 → 경비 → 그 외 지출액 → 매출 블록, 블록마다 F열 총액 =SUM + H열 메모
// 항목 이름은 고객사 문서 「팀별 경영 대시보드 구분」 표기 (2026-10-25 결정)
// - 월 시트: "월간 상품 매입액" 그대로 / 합계 시트: "월간"을 빼고 "상품 매입액" (3개월 합계를 한 달 금액으로 읽지 않게)
// - H열 메모: "← 당월 매입 (월간 입력)" / 합계 시트 "← 3분기 매입 (월간 입력)" — 경영지원 관리 시트의 "← 당월 매입 지출"(외상매입금)과 구분
// - H1 상태, H2 제외한 달: 확정 안 됨·입력 없음은 원본 빨간 글씨
import { SheetBuilder, type GroupStyle } from "../../export/blocks";
import { COL, type SheetLayout } from "../../export/draw";
import type { EntryField } from "../schemas";
import type { EntrySheet } from "./plan";

export type EntryRole =
  "title" | "header" | "name" | "amount" | "note" | "total" | "memo";

/** 블록 사이 빈 행 순서 (0 = 첫 블록 뒤 9.95, 1·2 = 9.75 — 원본 38·50·63행) */
export type EntryLayout = SheetLayout<EntryRole, number>;

/** 고객사 문서 표기에서 "월간 "을 뺀 이름 */
export const ENTRY_ITEM_LABEL: Record<EntryField, string> = {
  goodsPurchase: "상품 매입액",
  materialPurchase: "원재료 매입액",
  operatingExpense: "경비 지출액",
  productSales: "제품 매출액",
  goodsSales: "상품 매출액",
  serviceSales: "용역 매출액",
};

export const OTHER_EXPENSE_TITLE = "그 외 지출액(광고선전비, 접대비 등)";

const STYLE: GroupStyle<EntryRole> = {
  name: "name",
  amount: "amount",
  note: "note",
  total: "total",
  memo: "memo",
};

type Block = {
  title: string;
  /** H열 메모 "← 당월 {memo} (월간 입력)" */
  memo: string;
  fields?: EntryField[];
};

const BLOCKS: Block[] = [
  {
    title: "매입",
    memo: "매입",
    fields: ["goodsPurchase", "materialPurchase"],
  },
  { title: "경비", memo: "경비 지출", fields: ["operatingExpense"] },
  { title: OTHER_EXPENSE_TITLE, memo: "그 외 지출" },
  {
    title: "매출",
    memo: "매출",
    fields: ["productSales", "goodsSales", "serviceSales"],
  },
];

export function itemLabel(field: EntryField, kind: EntrySheet["kind"]) {
  return kind === "month"
    ? `월간 ${ENTRY_ITEM_LABEL[field]}`
    : ENTRY_ITEM_LABEL[field];
}

export function buildEntrySheetLayout(sheet: EntrySheet): EntryLayout {
  const b = new SheetBuilder<EntryRole, number>();
  BLOCKS.forEach((block, i) => {
    if (i > 0) b.separator(i - 1);
    const titleRow = b.title(
      sheet.titleSuffix ? `${block.title} ${sheet.titleSuffix}` : block.title,
      "title",
    );
    b.header([
      { col: COL.C, role: "header", value: "항목" },
      { col: COL.D, role: "header", value: "금액" },
      { col: COL.E, role: "header", value: "적요" },
      { col: COL.F, role: "header", value: "총액" },
    ]);
    const items = block.fields
      ? block.fields.map((f) => ({
          name: itemLabel(f, sheet.kind),
          amount: sheet.values[f],
          note: null,
        }))
      : sheet.others.map((o) => ({
          name: o.name,
          amount: o.amount,
          note: o.inactive ? "비활성 항목" : null,
        }));
    b.group(items, STYLE, {
      text: `${sheet.memoLabel} ${block.memo} (월간 입력)`,
    });
    if (i === 0) {
      b.cell(titleRow, {
        col: COL.H,
        role: "memo",
        value: sheet.status.text,
        ...(sheet.status.warn ? { warn: true } : {}),
      });
      if (sheet.status2) {
        b.cell(titleRow + 1, {
          col: COL.H,
          role: "memo",
          value: sheet.status2.text,
          ...(sheet.status2.warn ? { warn: true } : {}),
        });
      }
    }
  });
  return b.layout();
}
