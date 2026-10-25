// 경영지원 엑셀 다운로드 공용 — 고객사 원본 양식(ledger-template.xlsx = 경영지원_관리.xlsx)에서 서식 읽기
// 모든 다운로드는 원본 파일을 불러와(테마·글꼴 유지) 원본 시트에서 서식을 읽은 뒤 시트를 새로 그린다.
// 새 통합 문서(new Workbook)로 만들면 exceljs 기본 테마가 들어가 머리글 회색(테마 2 = E7E6E6)·연두(테마 9)가 다른 색이 된다
// 배포 결과물에 이 파일이 들어가도록 next.config.ts 의 outputFileTracingIncludes 에 등록돼 있다
import { readFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

export const TEMPLATE_RELATIVE_PATH =
  "src/modules/management/ledger/export/ledger-template.xlsx";

export class ExportTemplateMissingError extends Error {
  constructor(readonly filePath: string) {
    super(
      "양식 파일을 찾을 수 없습니다 (ledger-template.xlsx). 관리자에게 알려 주세요.",
    );
    this.name = "ExportTemplateMissingError";
  }
}

/**
 * 경로는 문자열 그대로 둔다 — 변수로 넘기면 Turbopack 이 정적 분석을 못 해 프로젝트 전체를 서버 결과물에 넣는다
 * (next build 경고 "Dynamic filesystem access causes tracing of the whole project")
 */
const readTemplateFile = () =>
  readFile(
    path.join(
      process.cwd(),
      "src/modules/management/ledger/export/ledger-template.xlsx",
    ),
  );

/** 원본 양식 파일 읽기 — 없거나 못 읽으면 ExportTemplateMissingError (read 는 테스트에서 바꿔 끼움) */
export async function readExportTemplate(
  read: () => Promise<Buffer> = readTemplateFile,
): Promise<Buffer> {
  try {
    return await read();
  } catch {
    throw new ExportTemplateMissingError(TEMPLATE_RELATIVE_PATH);
  }
}

/** 원본 행 번호(2026-10-25 확인): 데이터 행 3, 블록 사이 빈 행 38(9.95)·50·63(9.75) */
export const DATA_ROW = 3;
export const SEPARATOR_ROWS = [38, 50, 63] as const;
/** 원본 빨간 글씨(장기미수 C3) — "주의할 숫자" 색. 새 색을 만들지 않고 원본에서 읽는다 */
const WARN_CELL = "C3";
/** 원본 일반 칸 글꼴 (잔액 칸 = 맑은 고딕 10) */
const BASE_FONT_CELL = "D5";

export type SheetBasics = {
  /** A~H 열 너비·숨김 (원본 그대로) */
  columns: { width?: number; hidden: boolean }[];
  rowHeight: number | undefined;
  /** 블록 사이 빈 행 높이, 원본 순서대로 (첫째 9.95, 그다음 9.75) */
  separatorHeights: (number | undefined)[];
  pageSetup: Partial<ExcelJS.PageSetup>;
  /** 서식 없는 칸·목록형 시트에 쓰는 글꼴 */
  baseFont: Partial<ExcelJS.Font>;
  /** 빨간 글씨 색 (원본 FF0000) */
  warnColor: Partial<ExcelJS.Color>;
};

const clone = <T>(v: T): T => structuredClone(v);

/** 원본 시트의 열·행 높이·인쇄 설정·기본 글꼴·빨간 글씨 색 */
export function readSheetBasics(ws: ExcelJS.Worksheet): SheetBasics {
  const columns = Array.from({ length: 8 }, (_, i) => {
    const col = ws.getColumn(i + 1);
    return { width: col.width, hidden: Boolean(col.hidden) };
  });
  return {
    columns,
    rowHeight: ws.getRow(DATA_ROW).height,
    separatorHeights: SEPARATOR_ROWS.map((r) => ws.getRow(r).height),
    pageSetup: clone(ws.pageSetup),
    baseFont: clone(ws.getCell(BASE_FONT_CELL).font),
    warnColor: clone(ws.getCell(WARN_CELL).font.color ?? { argb: "FFFF0000" }),
  };
}

/** 역할 → 원본 셀 주소 표로 서식을 복사해 온다 */
export function readRoleStyles<R extends string>(
  ws: ExcelJS.Worksheet,
  cells: Record<R, string>,
): Record<R, Partial<ExcelJS.Style>> {
  const roles = {} as Record<R, Partial<ExcelJS.Style>>;
  for (const [role, address] of Object.entries(cells) as [R, string][]) {
    roles[role] = clone(ws.getCell(address).style);
  }
  return roles;
}

/** 원본 파일을 열고 원본 시트를 넘겨준다 — 서식을 다 읽은 뒤 dropSource() 로 원본 시트를 지운다 */
export async function openTemplateWorkbook(template: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template as unknown as ArrayBuffer);
  const source = wb.worksheets[0];
  return { wb, source, dropSource: () => wb.removeWorksheet(source.id) };
}

/**
 * 문서 속성: 원본의 작성자·마지막 수정자(개인 이름)를 남기지 않고 프로그램 이름으로 (2026-10-25 결정)
 * 엑셀이 열 때 다시 계산하도록 fullCalcOnLoad (계산값도 함께 저장돼 있어 바로 숫자가 보임)
 */
export const WORKBOOK_AUTHOR = "NEWTORK 경영 대시보드";

export async function writeWorkbook(
  wb: ExcelJS.Workbook,
  now: Date,
): Promise<Buffer> {
  wb.creator = WORKBOOK_AUTHOR;
  wb.lastModifiedBy = WORKBOOK_AUTHOR;
  wb.created = now;
  wb.modified = now;
  wb.calcProperties.fullCalcOnLoad = true;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
