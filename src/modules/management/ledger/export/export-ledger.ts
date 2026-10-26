// 경영지원 관리 엑셀 다운로드 (서버 전용) — 권한 확인은 부르는 쪽(Route Handler)에서 can() 으로
// 누가 언제 어느 기간을 받았는지 변경 기록(audit_log)에 남기고, 기록이 실패하면 다운로드도 막는다 (2026-10-25 결정)
import "server-only";

import { recordAudit } from "@/shared/audit/record";
import { prisma } from "@/shared/db/client";

import { getNow, getTodayKst } from "../../data/load-summary-input";
import { readExportTemplate } from "../../export/template";
import { loadLedgerRowsByMonth } from "../load-ledger";
import { formatLedgerMonth, toDateOnly } from "../rules";
import { buildLedgerWorkbook } from "./build-ledger-workbook";
import {
  exportFileName,
  exportMonths,
  parseExportPeriod,
  planExportSheets,
} from "./period";

export class LedgerExportError extends Error {
  constructor(
    readonly status: 400 | 503,
    message: string,
  ) {
    super(message);
    this.name = "LedgerExportError";
  }
}

export type LedgerExport = {
  body: Buffer;
  fileName: string;
  asciiName: string;
  period: string;
  sheetNames: string[];
  rowCount: number;
};

/** ?period=2026-10 | 2026-Q4 | 2026 → .xlsx (숨긴 행 제외, 화면 필터와 상관없이 기간 전체) */
export async function exportLedger(
  periodParam: string | null,
  actor: { id: string; loginId: string },
): Promise<LedgerExport> {
  const period = parseExportPeriod(periodParam);
  if (!period) {
    throw new LedgerExportError(
      400,
      "기간 형식이 올바르지 않습니다. (예: 2026-10, 2026-Q4, 2026)",
    );
  }
  const today = toDateOnly(await getTodayKst());
  const months = exportMonths(period, today);
  if (months.length === 0) {
    throw new LedgerExportError(400, "미래 기간은 내려받을 수 없습니다.");
  }

  const template = await readExportTemplate();
  const byMonth = await loadLedgerRowsByMonth(months);
  const sheets = planExportSheets(
    period,
    months,
    (ym) => byMonth.get(formatLedgerMonth(ym)) ?? [],
  );
  const now = await getNow();
  const body = await buildLedgerWorkbook({ template, sheets, now });
  const names = exportFileName(period);
  const rowCount = sheets.reduce((n, s) => n + s.rows.length, 0);

  try {
    await recordAudit(prisma, {
      occurredAt: now,
      actor,
      area: "management",
      screen: "ledger-export",
      action: "EXPORT",
      target: {
        type: "LedgerExport",
        id: periodParam ?? "",
        label: `경영지원 관리 엑셀 다운로드 · ${periodParam}`,
      },
      meta: {
        period: periodParam,
        fileName: names.fileName,
        sheets: sheets.map((s) => s.sheetName),
        sheetCount: sheets.length,
        rows: rowCount,
      },
    });
  } catch (error) {
    console.error("[ledger-export] 다운로드 기록 실패", error);
    throw new LedgerExportError(
      503,
      "다운로드 기록을 남기지 못해 다운로드를 막았습니다. 잠시 후 다시 시도하세요.",
    );
  }
  return {
    body,
    ...names,
    period: periodParam ?? "",
    sheetNames: sheets.map((s) => s.sheetName),
    rowCount,
  };
}
