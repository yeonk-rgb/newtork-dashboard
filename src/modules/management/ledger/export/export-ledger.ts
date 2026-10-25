// 채권·채무 엑셀 다운로드 (서버 전용) — 권한 확인은 부르는 쪽(Route Handler)에서 can() 으로
import "server-only";

import { getNow, getTodayKst } from "../../data/load-summary-input";
import { loadLedgerRowsByMonth } from "../load-ledger";
import { formatLedgerMonth, toDateOnly } from "../rules";
import { buildLedgerWorkbook } from "./build-ledger-workbook";
import {
  exportFileName,
  exportMonths,
  parseExportPeriod,
  planExportSheets,
} from "./period";
import { readLedgerTemplate } from "./template";

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

  const template = await readLedgerTemplate();
  const byMonth = await loadLedgerRowsByMonth(months);
  const sheets = planExportSheets(
    period,
    months,
    (ym) => byMonth.get(formatLedgerMonth(ym)) ?? [],
  );
  const body = await buildLedgerWorkbook({
    template,
    sheets,
    now: await getNow(),
  });
  const names = exportFileName(period);
  return {
    body,
    ...names,
    period: periodParam ?? "",
    sheetNames: sheets.map((s) => s.sheetName),
    rowCount: sheets.reduce((n, s) => n + s.rows.length, 0),
  };
}
