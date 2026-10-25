// 채권·채무 엑셀 다운로드 — 고객사 원본 양식(ledger-template.xlsx)에서 서식 읽기 (2026-10-25 결정: A안)
// 셀 서식은 "역할 → 원본 셀 주소" 표(ROLE_CELLS) 하나로 가져온다. 양식이 바뀌면 파일만 바꾸고,
// 역할 칸이 옮겨졌으면 build-ledger-workbook.test.ts 의 원본 서식 비교 테스트가 알려 준다
// 배포 결과물에 이 파일이 들어가도록 next.config.ts 의 outputFileTracingIncludes 에 등록돼 있다
import { readFile } from "node:fs/promises";
import path from "node:path";

import type ExcelJS from "exceljs";

import type { StyleRole } from "./layout";

export const TEMPLATE_RELATIVE_PATH =
  "src/modules/management/ledger/export/ledger-template.xlsx";

export class LedgerTemplateMissingError extends Error {
  constructor(readonly filePath: string) {
    super(
      "양식 파일을 찾을 수 없습니다 (ledger-template.xlsx). 관리자에게 알려 주세요.",
    );
    this.name = "LedgerTemplateMissingError";
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

/** 원본 양식 파일 읽기 — 없거나 못 읽으면 LedgerTemplateMissingError (read 는 테스트에서 바꿔 끼움) */
export async function readLedgerTemplate(
  read: () => Promise<Buffer> = readTemplateFile,
): Promise<Buffer> {
  try {
    return await read();
  } catch {
    throw new LedgerTemplateMissingError(TEMPLATE_RELATIVE_PATH);
  }
}

/**
 * 역할 → 원본 셀. 원본 행 번호(2026-10-25 확인):
 * 외상매출금 장기미수 3~4 / 당월수금완료 5~24 / 당월수금예정 25~37, 외상매입금 41~49,
 * 미지급비용-직원 53~62, 미지급비용-업체 자동이체 66 · 일반 67~79
 */
export const ROLE_CELLS: Record<Exclude<StyleRole, "extraAmount">, string> = {
  title: "C1",
  codeHeader: "A2",
  header: "C2",
  code: "A5",
  longName: "C3",
  longAmount: "D3",
  longNote: "E3",
  longTotal: "F3",
  collectedName: "C5",
  collectedAmount: "D5",
  collectedNote: "E5",
  scheduledName: "C25",
  scheduledAmount: "D25",
  scheduledNote: "E25",
  arTotal: "F5",
  apName: "C41",
  apAmount: "D41",
  apNote: "E41",
  staffName: "C53",
  staffAmount: "D53",
  staffNote: "E53",
  vendorName: "C67",
  vendorAmount: "D67",
  vendorNote: "E67",
  autoName: "C66",
  autoAmount: "D66",
  autoNote: "E66",
  autoTotalCol: "F66",
  otherTotal: "F41",
  vendorTotal: "F67",
  memo: "H3",
  memoAp: "H44",
  memoStaff: "H58",
  memoVendor: "H73",
  extraLabel: "H73",
};

/** 블록 사이 빈 행 (원본 38·50·63행) 과 데이터 행 높이 (원본 3행) */
export const SEPARATOR_ROWS = { AR: 38, AP: 50, ACCRUED_STAFF: 63 } as const;
export const DATA_ROW = 3;

export type TemplateStyles = {
  roles: Record<StyleRole, Partial<ExcelJS.Style>>;
  /** A~H 열 너비·숨김 (원본 그대로) */
  columns: { width?: number; hidden: boolean }[];
  rowHeight: number | undefined;
  separatorHeights: Record<keyof typeof SEPARATOR_ROWS, number | undefined>;
  pageSetup: Partial<ExcelJS.PageSetup>;
  /** 원본 일반 칸 글꼴 (잔액 칸 = 맑은 고딕 10) — 서식 없는 칸·상세 시트에 쓴다 */
  baseFont: Partial<ExcelJS.Font>;
};

const clone = <T>(v: T): T => structuredClone(v);

/** 원본 시트에서 역할별 서식·열·행 높이·인쇄 설정을 읽는다 */
export function readTemplateStyles(ws: ExcelJS.Worksheet): TemplateStyles {
  const roles = {} as Record<StyleRole, Partial<ExcelJS.Style>>;
  for (const [role, address] of Object.entries(ROLE_CELLS)) {
    roles[role as StyleRole] = clone(ws.getCell(address).style);
  }
  // I열 "자동이체 합계·전체 합계" 금액: 원본에 없는 칸 — 총액(F) 글꼴·서식(#,##0 굵게)에 테두리 없이 오른쪽 정렬
  const total = clone(ws.getCell(ROLE_CELLS.otherTotal).style);
  roles.extraAmount = {
    font: total.font,
    numFmt: total.numFmt ?? "#,##0",
    alignment: { horizontal: "right", vertical: "middle" },
  };

  const columns = Array.from({ length: 8 }, (_, i) => {
    const col = ws.getColumn(i + 1);
    return { width: col.width, hidden: Boolean(col.hidden) };
  });
  return {
    roles,
    columns,
    rowHeight: ws.getRow(DATA_ROW).height,
    separatorHeights: {
      AR: ws.getRow(SEPARATOR_ROWS.AR).height,
      AP: ws.getRow(SEPARATOR_ROWS.AP).height,
      ACCRUED_STAFF: ws.getRow(SEPARATOR_ROWS.ACCRUED_STAFF).height,
    },
    pageSetup: clone(ws.pageSetup),
    baseFont: clone(ws.getCell(ROLE_CELLS.collectedAmount).font),
  };
}
