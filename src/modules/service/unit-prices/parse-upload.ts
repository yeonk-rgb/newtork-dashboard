// 단가 업로드 파일 해석 (순수 함수 — DB 모름). CSV·엑셀 공통 (파일 읽기는 shared/upload/read-table.ts)
// ① 부품 단가표: 분류·파트넘버·품목·적용 모델·기준단가
//    - 머리글에 "파트넘버"가 있으면 한 줄 = 한 부품 (분류 칸이 비면 바로 위 분류 제목 행을 씀)
//    - 고객사 원본 "부품" 시트 형식도 인식: 머리글 "구분·품목·적요·기준단가", 분류는 칸 하나만 있는 제목 행("01 현장서비스")
// ② 출장지별 단가: 파트넘버·출장지·단가·적용 시작일·비고(선택)
// 오류가 1건이라도 있으면 저장하지 않는다 (미리보기에서 보여 줌)
import type { Cell, SheetTable } from "@/shared/upload/read-table";

import { itemKey, partKey } from "./compute";

export type UploadKind = "items" | "quotes";

export const UPLOAD_KIND_LABEL: Record<UploadKind, string> = {
  items: "부품 단가표",
  quotes: "출장지별 단가",
};

/** 금액 한도 (원) — 실수로 큰 값을 넣었을 때 막기 */
export const MAX_PRICE = 10_000_000_000;

export type ItemValues = {
  partNo: string;
  /** 같은 부품 판별 = 파트넘버 + 품목 */
  key: string;
  partKey: string;
  category: string;
  name: string;
  appliesTo: string;
  basePrice: number | null;
};

export type QuoteValues = {
  partNo: string;
  /** 파트넘버 비교용 (partKey) */
  key: string;
  /** 품목 (선택) — 파트넘버가 같은 부품이 여럿일 때 고르는 데 씀 */
  name: string;
  company: string;
  unitPrice: number;
  effectiveDate: string;
  note: string;
};

export type RowError = { row: number; message: string };

export type Parsed<T> =
  | {
      ok: true;
      sheetName: string;
      /** 원본 "부품" 시트 형식으로 읽었는지 */
      original: boolean;
      rows: { row: number; values: T }[];
      errors: RowError[];
      /** 빈 줄·분류 제목 줄 등 건너뛴 수 */
      skipped: number;
    }
  | { ok: false; error: string };

const norm = (v: Cell) =>
  String(v ?? "")
    .replace(/\s/g, "")
    .toLowerCase();
const text = (v: Cell) => (v === null ? "" : String(v).trim());

const ITEM_HEADERS = {
  category: ["분류", "카테고리"],
  partNo: ["파트넘버", "partno", "part_no", "품번"],
  name: ["품목", "품명"],
  appliesTo: ["적용모델", "적요"],
  basePrice: ["기준단가", "뉴토크기준값", "기준값", "단가표기준단가"],
} as const;

const QUOTE_HEADERS = {
  partNo: ["파트넘버", "partno", "part_no", "품번"],
  name: ["품목", "품명"],
  company: ["출장지", "출장지(업체)", "업체", "업체명", "출장지명"],
  unitPrice: ["단가", "단가(원)", "업체단가", "단가(원,부가세제외)"],
  effectiveDate: ["적용시작일", "적용일", "견적일", "날짜"],
  note: ["비고", "메모"],
} as const;

type HeaderMap<K extends string> = Partial<Record<K, number>>;

function findColumns<K extends string>(
  row: Cell[],
  spec: Record<K, readonly string[]>,
): HeaderMap<K> {
  const map: HeaderMap<K> = {};
  row.forEach((cell, i) => {
    const h = norm(cell);
    if (!h) return;
    for (const key of Object.keys(spec) as K[]) {
      if (map[key] === undefined && spec[key].includes(h)) map[key] = i;
    }
  });
  return map;
}

/** 금액 칸: 숫자 또는 "1,234,000"·"1,234,000원". 빈칸 = null */
export function readPrice(
  v: Cell,
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (v === null || (typeof v === "string" && v.trim() === "")) {
    return { ok: true, value: null };
  }
  const n =
    typeof v === "number" ? v : Number(String(v).replace(/[,\s원]/g, ""));
  if (!Number.isFinite(n)) {
    return { ok: false, message: `금액이 숫자가 아닙니다: "${text(v)}"` };
  }
  if (!Number.isInteger(n)) {
    return { ok: false, message: `금액은 원 단위 정수여야 합니다: ${n}` };
  }
  if (n < 0) return { ok: false, message: `금액이 음수입니다: ${n}` };
  if (n > MAX_PRICE) return { ok: false, message: `금액이 너무 큽니다: ${n}` };
  return { ok: true, value: n };
}

/** 날짜 칸: "2026-03-10"·"2026.3.10"·"2026/03/10"·엑셀 날짜 일련번호 → "YYYY-MM-DD" */
export function readDate(v: Cell): string | null {
  if (v === null) return null;
  if (typeof v === "number") {
    if (v < 20000 || v > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const m = /^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\.?$/.exec(
    String(v).trim(),
  );
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

const isBlankRow = (row: Cell[]) => row.every((c) => text(c) === "");
const HEADER_SCAN = 15;

// ---------- ① 부품 단가표 ----------

function findItemHeader(sheet: SheetTable) {
  for (let r = 0; r < Math.min(sheet.rows.length, HEADER_SCAN); r += 1) {
    const cols = findColumns(sheet.rows[r], ITEM_HEADERS);
    if (
      cols.partNo !== undefined &&
      cols.name !== undefined &&
      cols.basePrice !== undefined
    ) {
      return { headerRow: r, cols, original: false };
    }
    // 원본 "부품" 시트: 구분(= 파트넘버) · 품목 · 적요 · 기준단가
    const original = findColumns(sheet.rows[r], {
      ...ITEM_HEADERS,
      partNo: ["구분"],
    });
    if (
      original.partNo !== undefined &&
      original.name !== undefined &&
      original.basePrice !== undefined
    ) {
      return { headerRow: r, cols: original, original: true };
    }
  }
  return null;
}

export function parseItemSheets(sheets: SheetTable[]): Parsed<ItemValues> {
  for (const sheet of sheets) {
    const found = findItemHeader(sheet);
    if (!found) continue;
    const { headerRow, cols, original } = found;
    const headerText = sheet.rows[headerRow].map(norm).join("|");
    const rows: { row: number; values: ItemValues }[] = [];
    const errors: RowError[] = [];
    const seen = new Map<string, number>();
    let skipped = 0;
    let section = "";
    const at = (row: Cell[], c: number | undefined) =>
      c === undefined ? "" : text(row[c] ?? null);
    for (let r = headerRow + 1; r < sheet.rows.length; r += 1) {
      const row = sheet.rows[r];
      const rowNo = r + 1;
      if (isBlankRow(row) || row.map(norm).join("|") === headerText) {
        skipped += 1;
        continue;
      }
      const partNo = at(row, cols.partNo);
      const name = at(row, cols.name);
      // CSV 는 줄마다 칸 수가 다를 수 있어 없는 칸 = null
      const price =
        cols.basePrice === undefined ? null : (row[cols.basePrice] ?? null);
      // 분류 제목 행: 칸 하나만 차 있음 (원본 "01 현장서비스")
      const filled = row.filter((c) => text(c ?? null) !== "");
      if (filled.length === 1 && !name && text(price) === "") {
        section = text(filled[0]);
        skipped += 1;
        continue;
      }
      if (!partNo) {
        errors.push({ row: rowNo, message: "파트넘버가 비어 있습니다." });
        continue;
      }
      if (!name) {
        errors.push({
          row: rowNo,
          message: `${partNo}: 품목이 비어 있습니다.`,
        });
        continue;
      }
      const p = readPrice(price ?? null);
      if (!p.ok) {
        errors.push({ row: rowNo, message: `${partNo}: ${p.message}` });
        continue;
      }
      const key = itemKey(partNo, name);
      const dup = seen.get(key);
      if (dup !== undefined) {
        errors.push({
          row: rowNo,
          message: `${partNo} ${name}: 파일 안에서 ${dup}행과 같은 파트넘버·품목입니다.`,
        });
        continue;
      }
      seen.set(key, rowNo);
      rows.push({
        row: rowNo,
        values: {
          partNo: partNo.slice(0, 100),
          key,
          partKey: partKey(partNo),
          category: (at(row, cols.category) || section).slice(0, 100),
          name: name.slice(0, 200),
          appliesTo: at(row, cols.appliesTo).slice(0, 200),
          basePrice: p.value,
        },
      });
    }
    if (rows.length === 0 && errors.length === 0) {
      return { ok: false, error: `"${sheet.sheetName}"에 부품 행이 없습니다.` };
    }
    return {
      ok: true,
      sheetName: sheet.sheetName,
      original,
      rows,
      errors,
      skipped,
    };
  }
  return {
    ok: false,
    error:
      "부품 단가표 머리글을 찾지 못했습니다. 첫 줄에 분류·파트넘버·품목·적용 모델·기준단가가 있어야 합니다. ([양식 내려받기] 참고)",
  };
}

// ---------- ② 출장지별 단가 ----------

export function parseQuoteSheets(sheets: SheetTable[]): Parsed<QuoteValues> {
  for (const sheet of sheets) {
    let headerRow = -1;
    let cols: HeaderMap<keyof typeof QUOTE_HEADERS> = {};
    for (let r = 0; r < Math.min(sheet.rows.length, HEADER_SCAN); r += 1) {
      const c = findColumns(sheet.rows[r], QUOTE_HEADERS);
      if (
        c.partNo !== undefined &&
        c.company !== undefined &&
        c.unitPrice !== undefined &&
        c.effectiveDate !== undefined
      ) {
        headerRow = r;
        cols = c;
        break;
      }
    }
    if (headerRow < 0) continue;
    const rows: { row: number; values: QuoteValues }[] = [];
    const errors: RowError[] = [];
    const seen = new Map<string, number>();
    let skipped = 0;
    const at = (row: Cell[], c: number | undefined) =>
      c === undefined ? null : (row[c] ?? null);
    for (let r = headerRow + 1; r < sheet.rows.length; r += 1) {
      const row = sheet.rows[r];
      const rowNo = r + 1;
      if (isBlankRow(row)) {
        skipped += 1;
        continue;
      }
      const partNo = text(at(row, cols.partNo));
      const company = text(at(row, cols.company));
      const problems: string[] = [];
      if (!partNo) problems.push("파트넘버가 비어 있습니다.");
      if (!company) problems.push("출장지가 비어 있습니다.");
      const p = readPrice(at(row, cols.unitPrice));
      if (!p.ok) problems.push(p.message);
      else if (p.value === null) problems.push("단가가 비어 있습니다.");
      const rawDate = at(row, cols.effectiveDate);
      const date = readDate(rawDate);
      if (!date) {
        problems.push(
          rawDate === null
            ? "적용 시작일이 비어 있습니다."
            : `적용 시작일을 읽지 못했습니다: "${text(rawDate)}" (예: 2026-03-10)`,
        );
      }
      if (problems.length) {
        errors.push({
          row: rowNo,
          message: `${partNo ? `${partNo}: ` : ""}${problems.join(" ")}`,
        });
        continue;
      }
      const key = partKey(partNo);
      const name = text(at(row, cols.name));
      const dupKey = `${key}|${name.replace(/\s/g, "").toUpperCase()}|${company}|${date}`;
      const dup = seen.get(dupKey);
      if (dup !== undefined) {
        errors.push({
          row: rowNo,
          message: `${partNo} ${company} ${date}: 파일 안에서 ${dup}행과 같은 부품·출장지·적용 시작일입니다.`,
        });
        continue;
      }
      seen.set(dupKey, rowNo);
      rows.push({
        row: rowNo,
        values: {
          partNo,
          key,
          name,
          company: company.slice(0, 100),
          unitPrice: (p as { value: number }).value,
          effectiveDate: date!,
          note: text(at(row, cols.note)).slice(0, 300),
        },
      });
    }
    if (rows.length === 0 && errors.length === 0) {
      return { ok: false, error: `"${sheet.sheetName}"에 단가 행이 없습니다.` };
    }
    return {
      ok: true,
      sheetName: sheet.sheetName,
      original: false,
      rows,
      errors,
      skipped,
    };
  }
  return {
    ok: false,
    error:
      "출장지별 단가 머리글을 찾지 못했습니다. 첫 줄에 파트넘버·출장지·단가·적용 시작일이 있어야 합니다. ([양식 내려받기] 참고)",
  };
}

// ---------- 양식 (CSV) ----------

export const TEMPLATE: Record<UploadKind, { file: string; rows: string[][] }> =
  {
    items: {
      file: "부품단가표_양식.csv",
      rows: [
        ["분류", "파트넘버", "품목", "적용 모델", "기준단가"],
        ["05 MOTOR", "VX-05-A-01", "Motor (예시)", "NTI-01 ~ 03", "500000"],
      ],
    },
    quotes: {
      file: "출장지별단가_양식.csv",
      rows: [
        ["파트넘버", "품목", "출장지", "단가", "적용 시작일", "비고"],
        [
          "VX-05-A-01",
          "Motor (예시)",
          "가상정수센터",
          "480000",
          "2026-03-10",
          "(예시)",
        ],
      ],
    },
  };

/** 엑셀에서 한글이 깨지지 않게 UTF-8 BOM, 줄바꿈 CRLF */
export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const t = v === null ? "" : String(v);
    return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return `﻿${rows.map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
}
