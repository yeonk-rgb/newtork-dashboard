// 출장보고서 엑셀(한 행 = 보고서 1건)을 서비스팀 DB 로 가져오기 — 친구 저장소 import_service_xlsx 명령과 같은 규칙
// 실행: npm run import:service -- <파일.xlsx>          확인만 (저장 안 함)
//       npm run import:service -- <파일.xlsx> --save   저장
// 시트 "출장보고서", 머리글은 parse-import.ts COLUMNS. 오류가 한 건이라도 있으면 아무것도 저장하지 않는다
import "dotenv/config";

import { basename } from "node:path";

import ExcelJS from "exceljs";

import {
  parseImportSheet,
  SHEET,
  type ImportCell,
} from "@/modules/service/import/parse-import";
import { planImport, saveImport } from "@/modules/service/import/save-import";
import { prisma } from "@/shared/db/client";

function cellValue(v: ExcelJS.CellValue): ImportCell {
  if (v === null || v === undefined) return null;
  if (
    v instanceof Date ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  )
    return v;
  if (typeof v === "object" && "richText" in v)
    return v.richText.map((t) => t.text).join("");
  if (typeof v === "object" && "result" in v)
    return cellValue(v.result as ExcelJS.CellValue);
  if (typeof v === "object" && "text" in v) return String(v.text);
  return String(v);
}

async function main() {
  const args = process.argv.slice(2);
  const path = args.find((a) => !a.startsWith("--"));
  const save = args.includes("--save");
  if (!path)
    throw new Error(
      "파일을 지정하세요: npm run import:service -- <파일.xlsx> [--save]",
    );
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(path);
  } catch {
    throw new Error(`파일이 없거나 읽을 수 없습니다: ${path}`);
  }
  const ws = wb.getWorksheet(SHEET);
  if (!ws)
    throw new Error(
      `'${SHEET}' 시트가 없습니다. 시트: ${wb.worksheets.map((w) => w.name).join(", ")}`,
    );
  const width = ws.columnCount;
  const table: ImportCell[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    table.push(
      Array.from({ length: width }, (_, c) =>
        cellValue(row.getCell(c + 1).value),
      ),
    );
  }
  const fileName = basename(path).normalize("NFC");
  const parsed = parseImportSheet(table, fileName);
  if (!parsed.ok) throw new Error(parsed.error);
  const { save: rows, skipped } = await planImport(parsed.rows);
  console.log(`파일: ${fileName} / 시트: ${SHEET}`);
  console.log(
    `저장 대상 ${rows.length}건, 건너뜀 ${skipped.length}건, 오류 ${parsed.errors.length}건`,
  );
  for (const line of skipped.slice(0, 20)) console.log(`  건너뜀 - ${line}`);
  for (const line of parsed.errors) console.log(`  오류 - ${line}`);
  if (parsed.errors.length) throw new Error("오류가 있어 저장하지 않았습니다.");
  if (!save) {
    console.log("확인만 했습니다. 저장하려면 --save를 붙여 다시 실행하세요.");
    return;
  }
  await saveImport(rows, fileName, new Date());
  console.log(`${rows.length}건 저장했습니다.`);
}

main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
