// 엑셀 파일 → 비교용 JSON (테스트·비교 스크립트 전용)
// 셀 값·수식·계산값·서식, 병합, 열·행, 보기·인쇄, 문서 속성, 테마 파일까지 — 리팩터링 전후 결과물이 같은지 확인할 때 쓴다
import { createHash } from "node:crypto";

import ExcelJS from "exceljs";
import JSZip from "jszip";

const sha = (text: string) =>
  createHash("sha256").update(text).digest("hex").slice(0, 16);

/** 값이 없는 칸(undefined) 은 빼서 JSON 비교가 흔들리지 않게 */
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null));

function dumpCell(cell: ExcelJS.Cell) {
  const style = clean(cell.style);
  const value = cell.value;
  const hasStyle = Object.keys(style ?? {}).length > 0;
  if ((value === null || value === undefined) && !hasStyle) return null;
  return {
    address: cell.address,
    ...(cell.isMerged && cell.master.address !== cell.address
      ? { master: cell.master.address }
      : {}),
    value: clean(
      cell.formula !== undefined
        ? { formula: cell.formula, result: cell.result }
        : value,
    ),
    style,
  };
}

function dumpSheet(ws: ExcelJS.Worksheet) {
  const cells: ReturnType<typeof dumpCell>[] = [];
  const rows: { row: number; height?: number; hidden?: boolean }[] = [];
  ws.eachRow({ includeEmpty: true }, (row, r) => {
    rows.push(clean({ row: r, height: row.height, hidden: row.hidden }));
    row.eachCell({ includeEmpty: true }, (cell) => {
      const d = dumpCell(cell);
      if (d) cells.push(d);
    });
  });
  const columns = Array.from({ length: ws.columnCount }, (_, i) => {
    const col = ws.getColumn(i + 1);
    return clean({
      col: i + 1,
      width: col.width,
      hidden: col.hidden,
      style: col.style,
    });
  });
  return {
    name: ws.name,
    state: ws.state,
    views: clean(ws.views),
    pageSetup: clean(ws.pageSetup),
    autoFilter: clean(ws.autoFilter),
    merges: [...(ws.model.merges ?? [])].sort(),
    columns,
    rows,
    cells,
  };
}

/** 압축 안의 문서 속성·테마 (exceljs 가 읽어 주지 않는 부분) */
export async function readPackageParts(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const text = async (name: string) =>
    (await zip.file(name)?.async("string")) ?? null;
  return {
    entries: Object.keys(zip.files).sort(),
    core: await text("docProps/core.xml"),
    app: await text("docProps/app.xml"),
    theme: await text("xl/theme/theme1.xml"),
    workbookXml: await text("xl/workbook.xml"),
  };
}

export async function dumpWorkbook(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const parts = await readPackageParts(buf);
  return {
    props: clean({
      creator: wb.creator,
      lastModifiedBy: wb.lastModifiedBy,
      created: wb.created,
      modified: wb.modified,
      company: wb.company,
      title: wb.title,
    }),
    package: {
      entries: parts.entries,
      core: parts.core,
      app: parts.app,
      themeSha: parts.theme ? sha(parts.theme) : null,
      fullCalcOnLoad:
        parts.workbookXml?.includes('fullCalcOnLoad="1"') ?? false,
    },
    sheets: wb.worksheets.map(dumpSheet),
  };
}
