// 엑셀 이관 테스트 도우미 (*.test.ts 에서만 import) — 픽스처 읽기, 메모리에서 고친 파일 만들기
import { readFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

import {
  readStyledXlsx,
  type StyledSheet,
} from "@/shared/upload/read-styled-sheet";

import { parseLedgerSheet, type ParseOptions } from "./parse-ledger-sheet";

export const FIXTURES = path.join(__dirname, "..", "__fixtures__");
export const OPTS: ParseOptions = {
  year: 2026,
  month: 10,
  today: "2026-10-25",
};

const toArrayBuffer = (buf: Buffer | ArrayBuffer): ArrayBuffer =>
  buf instanceof ArrayBuffer
    ? buf
    : (buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength,
      ) as ArrayBuffer);

async function readSheet(data: ArrayBuffer): Promise<StyledSheet> {
  const read = await readStyledXlsx("test.xlsx", data);
  if (!read.ok) throw new Error(read.error);
  return read.sheets[0];
}

/** 픽스처 파일 → 시트 */
export async function fixtureSheet(name: string): Promise<StyledSheet> {
  return readSheet(toArrayBuffer(await readFile(path.join(FIXTURES, name))));
}

/** 픽스처를 exceljs 로 열어 고친 뒤 다시 읽은 시트 (원본 파일은 그대로) */
export async function editedSheet(
  name: string,
  edit: (ws: ExcelJS.Worksheet) => void,
): Promise<StyledSheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(FIXTURES, name));
  edit(wb.worksheets[0]);
  return readSheet(toArrayBuffer(await wb.xlsx.writeBuffer()));
}

export async function parseFixture(name: string, opts = OPTS) {
  return parseLedgerSheet(await fixtureSheet(name), opts);
}
