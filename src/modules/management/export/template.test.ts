// 경영지원 다운로드 공용: 양식 파일·테마 색·문서 속성 고정 (경영지원 관리, 월간 입력 결과물 모두)
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildEntryWorkbook } from "../entry/export/build-entry-workbook";
import { planEntrySheets } from "../entry/export/plan";
import { SAMPLE_CATEGORIES, SAMPLE_MONTHS } from "../entry/export/test-data";
import { TEMPLATE_PATH } from "../ledger/import/test-helpers";
import { buildLedgerWorkbook } from "../ledger/export/build-ledger-workbook";
import { SAMPLE_ROWS } from "../ledger/export/test-rows";
import { comparePackage, unintended } from "./compare";
import { parseExportPeriod } from "./period";
import {
  ExportTemplateMissingError,
  readExportTemplate,
  WORKBOOK_AUTHOR,
} from "./template";
import { dumpWorkbook, readPackageParts } from "./testing/dump-workbook";

const NOW = new Date("2026-10-25T03:00:00Z");

async function outputs() {
  const template = await readFile(TEMPLATE_PATH);
  const period = parseExportPeriod("2026-Q3")!;
  return {
    template,
    files: {
      채권채무: await buildLedgerWorkbook({
        template,
        sheets: [{ sheetName: "2026-10", month: "2026-10", rows: SAMPLE_ROWS }],
        now: NOW,
      }),
      월간입력: await buildEntryWorkbook({
        template,
        sheets: planEntrySheets({
          period,
          months: [7, 8, 9].map((month) => ({ year: 2026, month })),
          data: SAMPLE_MONTHS,
          categories: SAMPLE_CATEGORIES,
        }),
        now: NOW,
      }),
    },
  };
}

describe("양식 파일", () => {
  it("없으면 알아볼 수 있는 오류", async () => {
    const missing = () => readFile("/없는/경로/ledger-template.xlsx");
    await expect(readExportTemplate(missing)).rejects.toBeInstanceOf(
      ExportTemplateMissingError,
    );
    await expect(readExportTemplate(missing)).rejects.toThrow(
      "양식 파일을 찾을 수 없습니다",
    );
  });
});

describe("테마 색 — 원본 그대로 (새 통합 문서 기본 테마로 바뀌지 않게)", () => {
  it("theme1.xml 이 원본과 같고 lt2 = E7E6E6(머리글 회색), accent6 = 70AD47(연두)", async () => {
    const { template, files } = await outputs();
    const original = await readPackageParts(template);
    expect(original.theme).toContain('<a:lt2><a:srgbClr val="E7E6E6"/>');
    for (const [name, buf] of Object.entries(files)) {
      const parts = await readPackageParts(buf);
      expect(parts.theme, name).toBe(original.theme);
      expect(parts.theme, name).toContain('<a:lt2><a:srgbClr val="E7E6E6"/>');
      expect(parts.theme, name).toContain(
        '<a:accent6><a:srgbClr val="70AD47"/>',
      );
    }
  });

  it("머리글 칸 채우기는 테마 2 (exceljs 기본 테마였다면 EEECE1 로 보였을 색)", async () => {
    const { files } = await outputs();
    for (const [name, buf] of Object.entries(files)) {
      const dump = await dumpWorkbook(buf);
      const header = dump.sheets[0].cells.find((c) => c?.value === "총액");
      expect(header?.style.fill, name).toMatchObject({ fgColor: { theme: 2 } });
    }
  });
});

describe("문서 속성 — 개인 이름이 남지 않는다", () => {
  it("작성자·마지막 수정자 = 프로그램 이름, 원본 작성자·수정자 이름 없음", async () => {
    const { template, files } = await outputs();
    const original = await readPackageParts(template);
    // 원본에는 개인 이름이 들어 있다 (이 테스트가 무엇을 막는지 확인)
    expect(original.core).toMatch(
      /<cp:lastModifiedBy>[^<]+<\/cp:lastModifiedBy>/,
    );
    for (const [name, buf] of Object.entries(files)) {
      const parts = await readPackageParts(buf);
      const rows = comparePackage(original, parts);
      expect(unintended(rows), name).toEqual([]);
      expect(parts.core, name).toContain(
        `<dc:creator>${WORKBOOK_AUTHOR}</dc:creator>`,
      );
      expect(parts.core, name).toContain(
        `<cp:lastModifiedBy>${WORKBOOK_AUTHOR}</cp:lastModifiedBy>`,
      );
      const people = [
        /<dc:creator>([^<]+)</.exec(original.core!)![1],
        /<cp:lastModifiedBy>([^<]+)</.exec(original.core!)![1],
      ];
      for (const person of people) {
        expect(parts.core, name).not.toContain(person);
        expect(parts.app, name).not.toContain(person);
      }
    }
  });
});
