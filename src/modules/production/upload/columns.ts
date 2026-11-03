// 제조내역 엑셀 양식 — 친구 저장소 backend/production/excel.py 그대로 (specs/01: 8~9행 머리글, 10행부터 데이터, 1행 = 일련번호 1개)
export const HEADER_ROW_1 = 8;
export const HEADER_ROW_2 = 9;
export const FIRST_DATA_ROW = 10;
/** Y열 */
export const LAST_COLUMN = 25;

export type ColumnKind = "text" | "date" | "bush" | "numberText";

export type RecordField =
  | "serialNo"
  | "modelCode"
  | "bushSize"
  | "rpm"
  | "power"
  | "manufacturedDate"
  | "inspectedDate"
  | "inspectionNo"
  | "orderNo"
  | "soNo"
  | "customerOrderNo"
  | "seller"
  | "finalClient"
  | "projectName"
  | "dueDate"
  | "shippedDate"
  | "note"
  | "etc"
  | "note2"
  | "opun"
  | "clun"
  | "oplo"
  | "cllo";

export type Column = {
  letter: string;
  headerRow: 8 | 9;
  header: string;
  field: RecordField;
  /** 화면 이름 */
  label: string;
  kind: ColumnKind;
  /** false: 머리글이 맞을 때만 읽는 보조 열 */
  required: boolean;
};

const col = (
  letter: string,
  headerRow: 8 | 9,
  header: string,
  field: RecordField,
  label: string,
  kind: ColumnKind,
  required = true,
): Column => ({ letter, headerRow, header, field, label, kind, required });

export const COLUMNS: Column[] = [
  col("B", 8, "일련번호", "serialNo", "일련번호", "text"),
  col("C", 8, "모델명", "modelCode", "모델명", "text"),
  col("D", 8, "부시 가공", "bushSize", "부시 가공", "bush"),
  col("E", 8, "rpm", "rpm", "rpm", "numberText"),
  col("F", 8, "전원", "power", "전원", "text"),
  col("G", 8, "제조년월", "manufacturedDate", "제조년월", "date"),
  col("H", 8, "검사일자", "inspectedDate", "검사일자", "date"),
  col("I", 8, "검사번호", "inspectionNo", "검사번호", "text"),
  col("J", 9, "PO번호", "orderNo", "수주번호", "text"),
  col("K", 9, "SO번호", "soNo", "SO번호", "text"),
  col("L", 8, "거래처 주문번호", "customerOrderNo", "거래처 주문번호", "text"),
  col("M", 8, "거래처", "seller", "판매처", "text"),
  col("N", 8, "최종발주처", "finalClient", "최종발주처", "text"),
  col("O", 8, "사업명", "projectName", "사업명", "text"),
  col("P", 8, "납기일", "dueDate", "납기일자", "date"),
  col("Q", 8, "출고일", "shippedDate", "출고일자", "date"),
  col("R", 8, "비고", "note", "비고", "text"),
  col("S", 9, "기타", "etc", "기타", "text", false),
  col("U", 9, "비고", "note2", "비고2", "text", false),
  col("V", 9, "OPUN", "opun", "OPUN", "numberText", false),
  col("W", 9, "CLUN", "clun", "CLUN", "numberText", false),
  col("X", 9, "OPLO", "oplo", "OPLO", "numberText", false),
  col("Y", 9, "CLLO", "cllo", "CLLO", "numberText", false),
];

/** 열 머리글이 아닌 묶음 머리글 (J8:K8 병합) */
export const EXTRA_HEADERS = [{ letter: "J", row: 8, header: "뉴토크 번호" }];

export const FIELD_LABEL = Object.fromEntries(
  COLUMNS.map((c) => [c.field, c.label]),
) as Record<RecordField, string>;

export const DATE_FIELDS = new Set<RecordField>(
  COLUMNS.filter((c) => c.kind === "date").map((c) => c.field),
);

/** 숫자 셀로 입력되면 앞자리 0이 사라지는 항목 (예: 일련번호 0001) */
export const ZERO_PADDED_FIELDS = new Set<RecordField>([
  "serialNo",
  "modelCode",
  "inspectionNo",
]);

export const columnIndex = (letter: string) =>
  letter.charCodeAt(0) - "A".charCodeAt(0);
