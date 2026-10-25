// 채권·채무 엑셀 다운로드 — 고객사 원본 양식(ledger-template.xlsx)에서 서식 읽기 (2026-10-25 결정: A안)
// 셀 서식은 "역할 → 원본 셀 주소" 표(ROLE_CELLS) 하나로 가져온다. 양식이 바뀌면 파일만 바꾸고,
// 역할 칸이 옮겨졌으면 build-ledger-workbook.test.ts 의 원본 서식 비교 테스트가 알려 준다
// 파일 읽기·열·인쇄 설정은 경영지원 다운로드 공용(../../export/template.ts)
import type ExcelJS from "exceljs";

import {
  readRoleStyles,
  readSheetBasics,
  type SheetBasics,
} from "../../export/template";
import type { StyleRole } from "./layout";

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

export type TemplateStyles = Omit<SheetBasics, "separatorHeights"> & {
  roles: Record<StyleRole, Partial<ExcelJS.Style>>;
  /** 블록 사이 빈 행 (원본 38·50·63행) */
  separatorHeights: Record<"AR" | "AP" | "ACCRUED_STAFF", number | undefined>;
};

/** 원본 시트에서 역할별 서식·열·행 높이·인쇄 설정을 읽는다 */
export function readTemplateStyles(ws: ExcelJS.Worksheet): TemplateStyles {
  const roles = readRoleStyles(ws, ROLE_CELLS) as Record<
    StyleRole,
    Partial<ExcelJS.Style>
  >;
  // I열 "자동이체 합계·전체 합계" 금액: 원본에 없는 칸 — 총액(F) 글꼴·서식(#,##0 굵게)에 테두리 없이 오른쪽 정렬
  const total = roles.otherTotal;
  roles.extraAmount = {
    font: structuredClone(total.font),
    numFmt: total.numFmt ?? "#,##0",
    alignment: { horizontal: "right", vertical: "middle" },
  };
  const basics = readSheetBasics(ws);
  const [AR, AP, ACCRUED_STAFF] = basics.separatorHeights;
  return {
    ...basics,
    roles,
    separatorHeights: { AR, AP, ACCRUED_STAFF },
  };
}
