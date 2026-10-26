// 변경 이력 엑셀 — 공용 엔진(원본 양식 파일 불러오기)으로 옮긴 뒤에도 목록형 형식은 그대로 (2026-10-26)
import { readFile } from "node:fs/promises";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { comparePackage, unintended } from "../export/compare";
import { WORKBOOK_AUTHOR } from "../export/template";
import {
  dumpWorkbook,
  readPackageParts,
} from "../export/testing/dump-workbook";
import { TEMPLATE_PATH } from "../ledger/import/test-helpers";
import { buildHistoryWorkbook } from "./build-history-workbook";
import { SAMPLE_HISTORY_ROWS } from "./testing/sample-rows";

const NOW = new Date("2026-10-26T03:00:00Z");

async function build() {
  const template = await readFile(TEMPLATE_PATH);
  const buf = await buildHistoryWorkbook(SAMPLE_HISTORY_ROWS, "변경 이력", {
    template,
    now: NOW,
  });
  return { buf, template };
}

describe("변경 이력 엑셀", () => {
  it("결과물 스냅샷 (값·서식·열·필터·인쇄 — 공용 엔진으로 옮길 때 시트 쪽 변화 0건 확인)", async () => {
    const { buf } = await build();
    await expect(
      JSON.stringify(await dumpWorkbook(buf), null, 1),
    ).toMatchFileSnapshot("__snapshots__/history-export.json");
  });

  it("원본 테마 그대로, 문서 속성에 개인 이름 없음 (다른 엑셀 5종과 같음)", async () => {
    const { buf, template } = await build();
    const original = await readPackageParts(template);
    const parts = await readPackageParts(buf);
    expect(parts.theme).toBe(original.theme);
    expect(unintended(comparePackage(original, parts))).toEqual([]);
    expect(parts.core).toContain(`<dc:creator>${WORKBOOK_AUTHOR}</dc:creator>`);
    expect(parts.core).not.toContain("Unknown");
  });

  it("목록형 형식 그대로: 시트 1장, 열 7개, 첫 행 고정, 자동 필터, 머리글 회색 굵게, 일시는 엑셀 날짜", async () => {
    const { buf } = await build();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["변경 이력"]);
    const ws = wb.worksheets[0];
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual([
      "일시",
      "이름",
      "아이디",
      "화면",
      "동작",
      "대상",
      "바뀐 내용",
    ]);
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(ws.autoFilter).toBe("A1:G1");
    expect(ws.getCell("A1").fill).toMatchObject({
      fgColor: { argb: "FFE7E6E6" },
    });
    expect(ws.getCell("A1").font).toMatchObject({
      bold: true,
      name: "맑은 고딕",
    });
    expect(ws.getCell("A2").numFmt).toBe("yyyy-mm-dd hh:mm");
    expect(ws.getCell("G2").value).toBe(
      "잔액: 12,500,000원 → 13,000,000원\n적요: (없음) → 10/15",
    );
    expect(ws.rowCount).toBe(1 + SAMPLE_HISTORY_ROWS.length);
  });
});
