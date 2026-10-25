import { readFile } from "node:fs/promises";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { readStyledXlsx } from "@/shared/upload/read-styled-sheet";

import { TEMPLATE_PATH } from "../import/test-helpers";
import {
  parseLedgerSheet,
  selectLedgerSheet,
} from "../import/parse-ledger-sheet";
import { buildImportPlan, EMPTY_CHOICES } from "../import/plan";
import { extraColumnWidth } from "../../export/draw";
import {
  buildLedgerWorkbook,
  DETAIL_SHEET_NAME,
  type ExportSheet,
} from "./build-ledger-workbook";
import { buildSheetLayout } from "./layout";
import { ROLE_CELLS } from "./template";
import { SAMPLE_ROWS } from "./test-rows";

const NOW = new Date("2026-10-25T03:00:00Z");
const OPTS = { year: 2026, month: 10, today: "2026-10-25" };

async function build(sheets: ExportSheet[]) {
  const template = await readFile(TEMPLATE_PATH);
  return buildLedgerWorkbook({ template, sheets, now: NOW });
}

async function openWorkbook(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb;
}

async function openTemplate() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  return wb.worksheets[0];
}

const october: ExportSheet = {
  sheetName: "2026-10",
  month: "2026-10",
  rows: SAMPLE_ROWS,
};

/** 서식 비교용: 글꼴·채우기·표시 형식·정렬 (테두리는 총액 칸에서 따로) */
const look = (s: Partial<ExcelJS.Style>) => ({
  font: s.font,
  fill: s.fill,
  numFmt: s.numFmt,
  alignment: s.alignment,
});

describe("원본 양식 서식과 같은지 (역할별)", () => {
  it("역할마다 원본 셀과 글꼴·채우기·표시 형식·정렬이 같다 (코드·자동이체 적요는 텍스트 서식만 다름)", async () => {
    const [template, wb] = [
      await openTemplate(),
      await openWorkbook(await build([october])),
    ];
    const ws = wb.getWorksheet("2026-10")!;
    const layout = buildSheetLayout(SAMPLE_ROWS);
    for (const [role, address] of Object.entries(ROLE_CELLS)) {
      const spec = layout.rows
        .flatMap((r) => r.cells.map((c) => ({ ...c, row: r.row })))
        .find((c) => c.role === role);
      if (!spec) continue;
      const expected = look(template.getCell(address).style);
      const actual = look(ws.getCell(spec.row, spec.col).style);
      if (spec.asText) expected.numFmt = "@";
      expect(actual, `${role} (원본 ${address})`).toEqual(expected);
    }
  });

  it("열 너비·숨긴 A열은 원본 그대로, A열 서식은 텍스트, I열은 금액이 다 보이게 넓힘", async () => {
    const [template, wb] = [
      await openTemplate(),
      await openWorkbook(await build([october])),
    ];
    const ws = wb.getWorksheet("2026-10")!;
    for (let c = 1; c <= 8; c++) {
      expect(ws.getColumn(c).width, `열 ${c}`).toBe(
        template.getColumn(c).width,
      );
    }
    expect(ws.getColumn(1).hidden).toBe(true);
    expect(ws.getColumn(1).numFmt).toBe("@");
    expect(ws.getColumn(9).width).toBe(extraColumnWidth(2_745_000));
    expect(extraColumnWidth(999_999_999_999_999)).toBeGreaterThanOrEqual(23);
    // 행 높이: 데이터 15, 블록 사이 빈 행 원본 값
    expect(ws.getRow(3).height).toBe(template.getRow(3).height);
    expect(ws.getRow(11).height).toBe(template.getRow(38).height);
  });

  it("장기미수 빨간 글씨, 자동이체 연두(테마 9), 총액 테두리 위·가운데·아래, I열 #,##0 굵게", async () => {
    const ws = (await openWorkbook(await build([october]))).getWorksheet(
      "2026-10",
    )!;
    expect(ws.getCell("C3").font.color).toEqual({ argb: "FFFF0000" });
    expect(ws.getCell("F3").font).toMatchObject({
      bold: true,
      color: { argb: "FFFF0000" },
    });
    const auto = 25; // 업체 제목 23, 머리글 24
    expect(ws.getCell(`C${auto}`).value).toBe("타파통신(가상)");
    expect(ws.getCell(`C${auto}`).fill).toMatchObject({
      fgColor: { theme: 9 },
    });
    const border = (a: string) =>
      Object.keys(ws.getCell(a).border ?? {}).sort();
    expect(border("F5")).toEqual(["left", "right", "top"]);
    expect(border("F6")).toEqual(["left", "right"]);
    expect(border("F7")).toEqual(["bottom", "left", "right"]);
    expect(ws.getCell(`I${auto + 2}`).style).toMatchObject({
      numFmt: "#,##0",
      font: { bold: true },
    });
  });

  it("인쇄: A4, 너비 1페이지 맞춤·높이 자동 — 월별 세로, 상세 가로, 여백은 원본", async () => {
    const [template, wb] = [
      await openTemplate(),
      await openWorkbook(await build([october])),
    ];
    const month = wb.getWorksheet("2026-10")!.pageSetup;
    const detail = wb.getWorksheet(DETAIL_SHEET_NAME)!.pageSetup;
    for (const [setup, orientation] of [
      [month, "portrait"],
      [detail, "landscape"],
    ] as const) {
      expect(setup).toMatchObject({
        paperSize: 9,
        orientation,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      });
      expect(setup.margins).toEqual(template.pageSetup.margins);
    }
  });

  it("자동이체 적요 '10/15' 는 날짜가 아니라 글자로 저장 (서식 @)", async () => {
    const ws = (await openWorkbook(await build([october]))).getWorksheet(
      "2026-10",
    )!;
    expect(ws.getCell("E25").value).toBe("10/15");
    expect(ws.getCell("E25").numFmt).toBe("@");
    expect(ws.getCell("A3").value).toBe("0000000087");
  });

  it("수식에 계산값도 저장, 원본 테마 파일 유지", async () => {
    const buf = await build([october]);
    const wb = await openWorkbook(buf);
    const ws = wb.getWorksheet("2026-10")!;
    expect(ws.getCell("F5").formula).toBe("SUM(D5:D7)");
    expect(ws.getCell("F5").result).toBe(7_150_000);
    // fullCalcOnLoad 는 exceljs 가 읽을 때 되살리지 않아 비교 보고서에서 workbook.xml 로 확인
    const zip = buf.toString("latin1");
    expect(zip).toContain("xl/theme/theme1.xml");
  });

  it("시트: 월별 + 맨 뒤 '상세'(원본에 없는 칸)", async () => {
    const wb = await openWorkbook(
      await build([
        october,
        { sheetName: "2026-09", month: "2026-09", rows: [] },
      ]),
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "2026-10",
      "2026-09",
      DETAIL_SHEET_NAME,
    ]);
    const detail = wb.getWorksheet(DETAIL_SHEET_NAME)!;
    expect(detail.getRow(1).values).toContain("완료일");
    expect(detail.rowCount).toBe(1 + SAMPLE_ROWS.length);
    const header = (detail.getRow(1).values as unknown[]).slice(1);
    const rowOf = (name: string) => {
      for (let r = 2; r <= detail.rowCount; r++) {
        if (detail.getCell(r, 4).value === name)
          return detail.getRow(r).values as unknown[];
      }
      return [];
    };
    const at = (name: string, col: string) =>
      rowOf(name)[header.indexOf(col) + 1];
    expect(at("마바건설(가상)", "완료일")).toBe("2026-10-15");
    expect(at("자차금속(가상)", "매입유형")).toBe("원재료매입");
    expect(at("타파통신(가상)", "자동이체")).toBe("○");
    expect(at("가나상사(가상)", "코드")).toBe("0000000087");
  });
});

describe("왕복: 다운로드 → 2단계 업로드 해석", () => {
  async function roundTrip(sheets: ExportSheet[], month = "2026-10") {
    const buf = await build(sheets);
    const read = await readStyledXlsx(
      "경영지원_관리_2026-10.xlsx",
      new Uint8Array(buf).buffer,
    );
    if (!read.ok) throw new Error(read.error);
    const selection = selectLedgerSheet(read.sheets, {
      month,
      requested: null,
    });
    if (!selection.ok) throw new Error(selection.reason);
    return { parsed: parseLedgerSheet(selection.sheet, OPTS), selection };
  }

  it("같은 행·상태·금액·코드(앞자리 0)·자동이체·적요, 원본 총액 전부 ✓", async () => {
    const { parsed } = await roundTrip([october]);
    expect(parsed.fatal).toEqual([]);
    const got = parsed.blocks.flatMap((b) =>
      b.rows.map((r) => ({
        kind: r.kind,
        arStatus: r.arStatus,
        code: r.partnerCode,
        name: r.partnerName,
        amount: r.amount?.toString(),
        note: r.note,
        autoTransfer: r.autoTransfer,
        errors: r.errors,
      })),
    );
    const want = SAMPLE_ROWS.map((r) => ({
      kind: r.kind,
      arStatus: r.arStatus,
      code: r.partnerCode,
      name: r.partnerName,
      amount: r.amount,
      note: r.note,
      autoTransfer: r.autoTransfer,
      errors: [],
    }));
    const key = (x: { name: string }) => x.name;
    expect([...got].sort((a, b) => key(a).localeCompare(key(b)))).toEqual(
      [...want].sort((a, b) => key(a).localeCompare(key(b))),
    );
    const totals = parsed.blocks.flatMap((b) => b.totals);
    expect(totals.map((t) => t.state)).toEqual(totals.map(() => "match"));
    // 장기미수 F열에도 SUM 을 넣었으므로 "원본 총액 없음"이 아니라 일치
    expect(totals[0]).toMatchObject({
      range: "F3:F4",
      state: "match",
      fileTotal: 16_900_000n,
    });
    expect(parsed.blocks.every((b) => b.skipped.codeOnly.length === 0)).toBe(
      true,
    );
  });

  it("그룹에 행이 1개뿐이어도(병합 없음) 그룹·상태·총액이 그대로 읽힘", async () => {
    // 그룹마다 1행 — F열을 병합할 수 없어 SUM 칸 하나가 그룹 (실제 10월 샘플 6행과 같은 모양)
    const one = (status: "LONG_OVERDUE" | "COLLECTED" | "SCHEDULED") =>
      SAMPLE_ROWS.find((r) => r.arStatus === status)!;
    const rows = [
      one("LONG_OVERDUE"),
      one("COLLECTED"),
      one("SCHEDULED"),
      SAMPLE_ROWS.find((r) => r.kind === "AP")!,
      SAMPLE_ROWS.find((r) => r.kind === "ACCRUED_STAFF")!,
      SAMPLE_ROWS.find((r) => r.kind === "ACCRUED_VENDOR" && !r.autoTransfer)!,
      SAMPLE_ROWS.find((r) => r.autoTransfer)!,
    ];
    const { parsed } = await roundTrip([
      { sheetName: "2026-10", month: "2026-10", rows },
    ]);
    expect(
      parsed.blocks[0].rows.map((r) => [r.partnerName, r.arStatus]),
    ).toEqual([
      ["가나상사(가상)", "LONG_OVERDUE"],
      ["다라엔지니어링(가상)", "COLLECTED"],
      ["바사플랜트(가상)", "SCHEDULED"],
    ]);
    const totals = parsed.blocks.flatMap((b) => b.totals);
    expect(totals.map((t) => [t.range, t.state])).toEqual([
      ["F3:F3", "match"],
      ["F4:F4", "match"],
      ["F5:F5", "match"],
      ["F9:F9", "match"],
      ["F13:F13", "match"],
      ["F18:F18", "match"],
    ]);
  });

  it("빈 달도 그대로 읽힘 — 가져올 데이터 없음, 총액 0 일치", async () => {
    const { parsed } = await roundTrip([
      { sheetName: "2026-10", month: "2026-10", rows: [] },
    ]);
    expect(parsed.fatal).toEqual([]);
    expect(parsed.blocks.every((b) => b.rows.length === 0)).toBe(true);
    expect(
      parsed.blocks.flatMap((b) => b.totals).every((t) => t.state === "match"),
    ).toBe(true);
  });

  it("매입유형·비용유형만 다시 고르면 저장 계획이 원래 행과 같다 (완료일은 기본값으로)", async () => {
    const { parsed } = await roundTrip([october]);
    const ap = parsed.blocks.find((b) => b.kind === "AP")!.rows;
    const plan = buildImportPlan(
      parsed,
      {
        ...EMPTY_CHOICES,
        purchaseType: Object.fromEntries(
          ap.map((r) => [r.row, "GOODS" as const]),
        ),
      },
      { ...OPTS, mode: null, existingTotal: 0 },
    );
    expect(plan.blockers).toEqual([]);
    expect(plan.entries).toHaveLength(SAMPLE_ROWS.length);
    expect(plan.summary.AR.sum).toBe(39_340_000n);
    expect(plan.summary.ACCRUED_VENDOR).toEqual({ count: 3, sum: 2_745_000n });
  });

  it("분기 파일: 기준년월과 같은 이름 시트를 자동 선택, '상세' 시트는 후보에서 빠짐", async () => {
    const sheets = [
      { sheetName: "2026-09", month: "2026-09", rows: SAMPLE_ROWS.slice(0, 2) },
      october,
    ];
    const { selection } = await roundTrip(sheets, "2026-10");
    expect(selection).toMatchObject({
      candidates: ["2026-09", "2026-10"],
      note: null,
    });
    expect(selection.ok && selection.sheet.name).toBe("2026-10");
  });
});

describe("selectLedgerSheet", () => {
  const sheet = (name: string, title = true) => ({
    name,
    rowCount: 1,
    columnCount: 3,
    cells: new Map(title ? [["1:3", { value: "외상매출금" }]] : []),
    merges: [],
    hiddenColumns: [],
  });

  it("양식 시트 1장이면 그 시트, 여러 장이면 같은 이름, 없으면 고르게", () => {
    expect(
      selectLedgerSheet([sheet("Sheet1")], {
        month: "2026-10",
        requested: null,
      }),
    ).toMatchObject({ ok: true, note: null });
    expect(
      selectLedgerSheet([sheet("2026-09"), sheet("2026-11")], {
        month: "2026-10",
        requested: null,
      }),
    ).toEqual({
      ok: false,
      reason: "choose",
      candidates: ["2026-09", "2026-11"],
    });
    expect(
      selectLedgerSheet([sheet("상세", false)], {
        month: "2026-10",
        requested: null,
      }),
    ).toEqual({
      ok: false,
      reason: "none",
    });
  });

  it("고른 시트 이름이 기준년월과 다르면 안내", () => {
    const r = selectLedgerSheet([sheet("2026-09"), sheet("2026-11")], {
      month: "2026-10",
      requested: "2026-11",
    });
    expect(r).toMatchObject({
      ok: true,
      note: "시트 이름(2026-11)과 기준년월(2026-10)이 다릅니다. 맞는지 확인하세요.",
    });
  });
});
