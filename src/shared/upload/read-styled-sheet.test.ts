import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  columnLetter,
  getCell,
  mergeAt,
  parseRange,
  readStyledXlsx,
} from "./read-styled-sheet";

const TEMPLATE = path.join(
  __dirname,
  "../../modules/management/ledger/__fixtures__/ledger-template.xlsx",
);

async function readTemplate() {
  const buf = await readFile(TEMPLATE);
  const data = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
  const read = await readStyledXlsx("경영지원 관리.xlsx", data);
  if (!read.ok) throw new Error(read.error);
  return read.sheets[0];
}

describe("readStyledXlsx", () => {
  it("병합·숨김 열·글자색·배경(직접 색·테마 색)·수식을 읽는다", async () => {
    const sheet = await readTemplate();
    expect(sheet.name).toBe("Sheet1");
    expect(sheet.hiddenColumns).toEqual([1]);
    expect(mergeAt(sheet, 4, 6)).toEqual({
      top: 3,
      left: 6,
      bottom: 4,
      right: 6,
    });
    expect(getCell(sheet, 3, 1)).toMatchObject({
      value: "0000000087",
      fill: { argb: "FFFFFF00" },
    });
    expect(getCell(sheet, 3, 3)?.font).toEqual({ argb: "FFFF0000" });
    expect(getCell(sheet, 66, 5)).toMatchObject({
      value: "자동이체",
      fill: { theme: 9 },
    });
    expect(getCell(sheet, 5, 6)).toMatchObject({
      value: null,
      formula: "SUM(D5:D24)",
      hasResult: false,
    });
  });

  it("병합된 칸의 첫 칸이 아닌 칸은 값이 없다 (제목 C1:F1)", async () => {
    const sheet = await readTemplate();
    expect(getCell(sheet, 1, 3)?.value).toBe("외상매출금");
    expect(getCell(sheet, 1, 4)?.value ?? null).toBeNull();
    expect(getCell(sheet, 6, 6)?.formula).toBeUndefined();
  });

  it(".xls·다른 확장자·깨진 파일은 안내 메시지", async () => {
    const empty = new ArrayBuffer(8);
    expect(await readStyledXlsx("a.xls", empty)).toMatchObject({ ok: false });
    expect(await readStyledXlsx("a.csv", empty)).toEqual({
      ok: false,
      error: ".xlsx 파일만 올릴 수 있습니다.",
    });
    const broken = await readStyledXlsx("a.xlsx", empty);
    expect(broken.ok).toBe(false);
  });
});

describe("범위 도우미", () => {
  it("parseRange·columnLetter", () => {
    expect(parseRange("F67:F79")).toEqual({
      top: 67,
      left: 6,
      bottom: 79,
      right: 6,
    });
    expect(parseRange("AA1:AB2")).toEqual({
      top: 1,
      left: 27,
      bottom: 2,
      right: 28,
    });
    expect(parseRange("F67")).toBeNull();
    expect([1, 6, 26, 27, 28].map(columnLetter)).toEqual([
      "A",
      "F",
      "Z",
      "AA",
      "AB",
    ]);
  });
});
