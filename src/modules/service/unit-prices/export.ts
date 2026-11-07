// 단가 내려받기 (서버 전용) — 화면과 같은 조건·같은 계산. 친구 앱 catalogSheets·companySheets 의 열 그대로(할인율·추가단가 열은 없앰)
// 엑셀 = 시트 여러 장, CSV = 부품별: 부품 단가 1개 / 출장지별: 부품별 차이 1개(출장지 열 포함)
import "server-only";

import ExcelJS from "exceljs";

import { getCurrentUser } from "@/shared/auth";

import { serviceAbilities } from "../rules";
import { companyComparison, itemRows, matchesQuery } from "./compute";
import { loadUnitPriceData, todayKst } from "./load-unit-prices";
import { TEMPLATE, toCsv, type UploadKind } from "./parse-upload";

type Col = [header: string, width: number, won?: boolean];
type Sheet = { title: string; cols: Col[]; rows: (string | number | null)[][] };

export type FileOut = {
  fileName: string;
  contentType: string;
  body: Uint8Array;
};

const CSV_TYPE = "text/csv; charset=utf-8";
const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function workbook(sheets: Sheet[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NEWTORK 경영 대시보드";
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.title, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = s.cols.map(([header, width, won]) => ({
      header,
      width,
      style: won ? { numFmt: "#,##0" } : {},
    }));
    ws.getRow(1).eachCell((c) => {
      c.font = { name: "맑은 고딕", bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F3A5F" },
      };
      c.alignment = { vertical: "middle", horizontal: "center" };
    });
    for (const r of s.rows) ws.addRow(r);
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

const csvOf = (s: Sheet) =>
  new TextEncoder().encode(toCsv([s.cols.map(([h]) => h), ...s.rows]));

export async function buildUnitPriceExport(input: {
  kind: string;
  q: string;
  category: string;
  format: string;
}): Promise<FileOut | "forbidden" | "bad-request"> {
  const user = await getCurrentUser();
  if (!serviceAbilities(user).canView) return "forbidden";
  if (input.kind !== "items" && input.kind !== "companies")
    return "bad-request";
  const csv = input.format === "csv";
  const data = await loadUnitPriceData();
  const day = data.today;
  const items = data.items.filter(
    (i) => !i.hidden && (!input.category || i.category === input.category),
  );

  let sheets: Sheet[];
  let base: string;
  if (input.kind === "items") {
    base = `부품단가_${day}`;
    const rows = itemRows(
      items.filter((i) => matchesQuery(i, input.q)),
      data.quotes,
      day,
    );
    sheets = [
      {
        title: "부품 단가",
        cols: [
          ["분류", 16],
          ["파트넘버", 14],
          ["품목", 24],
          ["적용 모델", 16],
          ["뉴토크 기준값", 15, true],
          ["출장지 평균", 14, true],
          ["출장지 최저", 14, true],
          ["출장지 최고", 14, true],
          ["최고-최저", 14, true],
          ["출장지 수", 10],
        ],
        rows: rows.map((r) => [
          r.category,
          r.partNo,
          r.name,
          r.appliesTo,
          r.basePrice,
          r.stats.average,
          r.stats.min,
          r.stats.max,
          r.stats.range,
          r.stats.count,
        ]),
      },
    ];
  } else {
    base = `출장지별단가비교_${day}`;
    const { companies } = companyComparison(items, data.quotes, day);
    const parts: Sheet = {
      title: "부품별 차이",
      cols: [
        ["출장지(업체)", 18],
        ["파트넘버", 14],
        ["품목", 24],
        ["뉴토크 기준값", 15, true],
        ["출장지 단가", 14, true],
        ["차이(원)", 14, true],
        ["차이율(%)", 10],
        ["적용 시작일", 13],
        ["크게 낮음", 10],
      ],
      rows: companies.flatMap((c) =>
        c.parts.map((p) => [
          c.company,
          p.partNo,
          p.name,
          p.basePrice,
          p.unitPrice,
          p.diff,
          p.diffRate,
          p.effectiveDate,
          p.low ? "크게 낮음" : "",
        ]),
      ),
    };
    const summary: Sheet = {
      title: "출장지 요약",
      cols: [
        ["출장지(업체)", 18],
        ["비교 부품 수", 12],
        ["평균 차이율(%)", 14],
        ["최저 차이율(%)", 14],
        ["최고 차이율(%)", 14],
        ["비쌈", 8],
        ["쌈", 8],
        ["크게 낮음", 10],
      ],
      rows: companies.map((c) => [
        c.company,
        c.count,
        c.averageRate,
        c.minRate,
        c.maxRate,
        c.above,
        c.below,
        c.low,
      ]),
    };
    sheets = csv ? [parts] : [summary, parts];
  }
  return csv
    ? { fileName: `${base}.csv`, contentType: CSV_TYPE, body: csvOf(sheets[0]) }
    : {
        fileName: `${base}.xlsx`,
        contentType: XLSX_TYPE,
        body: await workbook(sheets),
      };
}

/** 업로드 양식 (CSV, 가짜 예시 1줄) */
export async function buildUnitPriceTemplate(
  kind: string,
): Promise<FileOut | "forbidden" | "bad-request"> {
  const user = await getCurrentUser();
  if (!serviceAbilities(user).canView) return "forbidden";
  if (kind !== "items" && kind !== "quotes") return "bad-request";
  await todayKst(); // 요청 시점에 만들기 (prerender 방지)
  const t = TEMPLATE[kind as UploadKind];
  return {
    fileName: t.file,
    contentType: CSV_TYPE,
    body: new TextEncoder().encode(toCsv(t.rows)),
  };
}
