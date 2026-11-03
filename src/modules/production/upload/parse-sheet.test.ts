// 제조내역 엑셀 파서·판정 — 친구 저장소 backend/production/tests/test_excel.py·test_upload_api.py 와 같은 규칙인지 고정
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { readTableFile, type Cell } from "@/shared/upload/read-table";

import { classify, recordKey, type ExistingRecord } from "./classify";
import { COLUMNS, columnIndex } from "./columns";
import { convert, parseSheet, parseWorkbook } from "./parse-sheet";
import { buildPreview } from "./preview";

/** 8~9행 머리글이 양식대로인 25열 표 */
function headerRows(): Cell[][] {
  const r8: Cell[] = Array(25).fill(null);
  const r9: Cell[] = Array(25).fill(null);
  for (const c of COLUMNS) {
    (c.headerRow === 8 ? r8 : r9)[columnIndex(c.letter)] = c.header;
  }
  r8[columnIndex("J")] = "뉴토크 번호";
  return [...Array(7).fill([]), r8, r9];
}

function dataRow(values: Record<string, Cell>, seq = 1): Cell[] {
  const row: Cell[] = Array(25).fill(null);
  row[0] = seq; // A열 순번
  for (const [letter, v] of Object.entries(values))
    row[columnIndex(letter)] = v;
  return row;
}

const table = (rows: Cell[][], sheetName = "2026") => ({
  sheetName,
  rows: [...headerRows(), ...rows],
});

const col = (field: string) => COLUMNS.find((c) => c.field === field)!;

describe("셀 변환", () => {
  it("날짜: 'YYYY-MM-DD'·'YYYY.M.D' 는 날짜, 못 읽으면 비우고 경고", () => {
    expect(convert(col("dueDate"), "2026-01-15").value).toBe("2026-01-15");
    expect(convert(col("dueDate"), "2026.1.5").value).toBe("2026-01-05");
    const bad = convert(col("dueDate"), "1월 중순");
    expect(bad.value).toBeNull();
    expect(bad.warning?.message).toMatch("날짜로 읽을 수 없어");
    expect(convert(col("dueDate"), "2026-02-30").value).toBeNull();
  });
  it("부시 가공: 숫자 셀은 6자리로 복원 (앞 0)", () => {
    expect(convert(col("bushSize"), 50806).value).toBe("050806");
    expect(convert(col("bushSize"), "301008").value).toBe("301008");
  });
  it("일련번호·모델명이 숫자 셀이면 경고 (앞자리 0이 빠졌을 수 있음)", () => {
    const r = convert(col("serialNo"), 1);
    expect(r.value).toBe("1");
    expect(r.warning?.message).toMatch("앞자리 0");
    expect(convert(col("seller"), 123).warning).toBeNull();
  });
  it("rpm 같은 숫자 글자는 정수면 소수점 없이", () => {
    expect(convert(col("rpm"), 24).value).toBe("24");
  });
});

describe("시트 읽기", () => {
  it("10행부터, 빈 행·순번만 있는 행 무시, 일련번호 없는 행 건너뜀, 파일 안 중복은 오류", () => {
    const s = parseSheet(
      table([
        dataRow({
          B: "0001",
          C: "02",
          J: "26006",
          M: "가상상사",
          P: "2026-01-15",
          Q: "2026-01-14",
        }),
        dataRow({}, 2), // 순번만 → 무시
        dataRow({ C: "02", M: "가상상사" }, 3), // 일련번호 없음 → 건너뜀
        dataRow({ B: "0001", C: "04" }, 4), // 중복
        dataRow({ B: "0002", Q: "출고 예정" }, 5),
      ]),
    );
    expect(s.error).toBeNull();
    expect(s.rows.map((r) => [r.row, r.values.serialNo])).toEqual([
      [10, "0001"],
      [14, "0002"],
    ]);
    expect(s.skippedRows).toEqual([12]);
    expect(s.duplicateRows).toEqual([
      { row: 13, serialNo: "0001", firstRow: 10 },
    ]);
    expect(s.rows[0].values).toMatchObject({
      modelCode: "02",
      orderNo: "26006",
      seller: "가상상사",
      dueDate: "2026-01-15",
      shippedDate: "2026-01-14",
      note: "",
    });
    expect(s.rows[1].values.shippedDate).toBeNull();
    expect(s.rows[1].warnings).toHaveLength(1);
  });

  it("머리글이 다르면 시트 오류, 모든 시트가 오류면 파일 오류", () => {
    const wrong = { sheetName: "메모", rows: [["아무거나"]] };
    expect(parseSheet(wrong).error).toMatch("제조내역 양식과 다릅니다");
    const r = parseWorkbook([wrong]);
    expect(r.ok).toBe(false);
    expect(parseWorkbook([wrong, table([])]).ok).toBe(true);
  });

  it("보조 열(S·U~Y)은 머리글이 맞을 때만 읽는다", () => {
    const t = table([dataRow({ B: "0001", V: 1868 })]);
    t.rows[8] = [...t.rows[8]];
    t.rows[8][columnIndex("V")] = "다른 이름";
    const s = parseSheet(t);
    expect(s.fields).not.toContain("opun");
    expect(s.fields).toContain("clun");
    expect(s.rows[0].values.opun).toBeUndefined();
  });
});

describe("저장된 행과 비교", () => {
  const sheet = parseSheet(
    table([
      dataRow({ B: "0001", M: "가상상사", Q: "2026-01-14" }),
      dataRow({ B: "0002", M: "새판매처" }, 2),
      dataRow({ B: "0003" }, 3),
      dataRow({ B: "0004" }, 4),
    ]),
  );
  const existing = new Map<string, ExistingRecord>([
    [
      recordKey("2026", "0001"),
      { id: "a", hidden: false, values: { ...sheet.rows[0].values } },
    ],
    [
      recordKey("2026", "0002"),
      {
        id: "b",
        hidden: false,
        values: { ...sheet.rows[1].values, seller: "옛판매처" },
      },
    ],
    [
      recordKey("2026", "0003"),
      { id: "c", hidden: true, values: { ...sheet.rows[2].values } },
    ],
  ]);

  it("새 행 / 바뀐 행(바뀐 칸) / 변경 없음 / 숨긴 행", () => {
    const c = classify([sheet], existing);
    expect(c.created.map((r) => r.row.values.serialNo)).toEqual(["0004"]);
    expect(c.unchanged.map((r) => r.row.values.serialNo)).toEqual(["0001"]);
    expect(c.hidden.map((r) => r.id)).toEqual(["c"]);
    expect(c.changed).toHaveLength(1);
    expect(c.changed[0].diffs).toEqual([
      {
        field: "seller",
        label: "판매처",
        before: "옛판매처",
        after: "새판매처",
      },
    ]);
  });

  it("미리보기 요약", () => {
    const p = buildPreview("x.xlsx", classify([sheet], existing), null);
    expect(p.summary).toMatchObject({
      created: 1,
      changed: 1,
      unchanged: 1,
      hidden: 1,
      skipped: 0,
      noShippedDate: 1,
    });
    expect(p.changed[0].key).toBe("2026::0002");
  });
});

describe("실제 xlsx 파일 (exceljs 로 만든 양식)", () => {
  it("날짜 셀·숫자 셀이 같은 규칙으로 읽힌다", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("2026(가상)");
    headerRows().forEach((row, i) =>
      row.forEach((v, j) => {
        if (v !== null) ws.getCell(i + 1, j + 1).value = v;
      }),
    );
    ws.getCell("A10").value = 1;
    ws.getCell("B10").value = "V26-0001";
    ws.getCell("C10").value = "02";
    ws.getCell("D10").value = 50806;
    ws.getCell("E10").value = 24;
    ws.getCell("P10").value = new Date(Date.UTC(2026, 0, 15));
    ws.getCell("Q10").value = new Date(Date.UTC(2026, 0, 14));
    const buffer = await wb.xlsx.writeBuffer();
    const read = await readTableFile("x.xlsx", buffer as ArrayBuffer);
    if (!read.ok) throw new Error(read.error);
    const parsed = parseWorkbook(read.sheets);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.sheets[0].rows[0].values).toMatchObject({
      serialNo: "V26-0001",
      modelCode: "02",
      bushSize: "050806",
      rpm: "24",
      dueDate: "2026-01-15",
      shippedDate: "2026-01-14",
    });
  });
});
