// 경영지원 엑셀 다운로드 (서버 전용) — GET /api/management/export?kind=…&period=… 하나로 받는다
// 권한 확인은 부르는 쪽(Route Handler)에서 can() 으로. 누가 언제 무엇을 받았는지 변경 기록(audit_log)에 남기고,
// 기록이 실패하면 다운로드도 막는다 (채권·채무 다운로드와 같은 정책, 2026-10-25)
// 채권·채무 다운로드는 기존 주소(/api/management/ledger/export) 그대로
import "server-only";

import { recordAudit } from "@/shared/audit/record";
import { prisma } from "@/shared/db/client";
import type { Period } from "@/shared/period/period";
import { toPeriodParam } from "@/shared/period/url";

import {
  getNow,
  getTodayKst,
  loadSummaryInput,
} from "../data/load-summary-input";
import { buildEntryWorkbook } from "../entry/export/build-entry-workbook";
import { loadEntryExportData } from "../entry/export/load-entry-export";
import { planEntrySheets } from "../entry/export/plan";
import { loadFinanceMonths } from "../data/queries";
import { planExportSheets } from "../ledger/export/period";
import { loadLedgerRowsByMonth } from "../ledger/load-ledger";
import { formatLedgerMonth } from "../ledger/rules";
import { DEFAULT_METRICS_SETTINGS } from "../metrics/settings";
import { computeManagementSummary } from "../metrics/summary";
import { computeTrend, trendRange } from "../metrics/trend";
import { buildReportLayout } from "../report/report-layout";
import {
  buildReceivablesLayout,
  receivablesListSheet,
} from "../receivables/export/receivables-layout";
import { buildTargetsLayout } from "../settings/export/targets-layout";
import {
  exportFileName,
  monthsUpTo,
  parseExportPeriod,
  periodSheetName,
} from "./period";
import { monthIndex } from "@/shared/period/period";
import { buildStackedWorkbook } from "./stacked";
import { readExportTemplate } from "./template";

export class ManagementExportError extends Error {
  constructor(
    readonly status: 400 | 503,
    message: string,
  ) {
    super(message);
    this.name = "ManagementExportError";
  }
}

/** 내려받을 수 있는 화면 (PR ③ 종합 리포트를 여기에 더한다) */
const KINDS = {
  entry: {
    screen: "entry-export",
    targetType: "EntryExport",
    label: "월간 입력 엑셀 다운로드",
    file: { ko: "월간입력", ascii: "entry" },
  },
  /** 목표 대비 실적 — 어떤 기간을 골라도 그 해 시트 1장 ("2026") */
  targets: {
    screen: "targets-export",
    targetType: "TargetsExport",
    label: "목표 대비 실적 엑셀 다운로드",
    file: { ko: "목표실적", ascii: "targets" },
  },
  /** 미수금 통계 — 기준일 = min(기간 말일, 오늘), 대시보드 KPI 와 같음 */
  receivables: {
    screen: "receivables-export",
    targetType: "ReceivablesExport",
    label: "미수금 엑셀 다운로드",
    file: { ko: "미수금", ascii: "receivables" },
  },
  /** 월별 종합 리포트 — 리포트 시트 + 채권·채무 월 시트 + 채권·채무 상세 + 미수금 상세 */
  report: {
    screen: "report-export",
    targetType: "ReportExport",
    label: "월별 리포트 엑셀 다운로드",
    file: { ko: "리포트", ascii: "report" },
  },
} as const;

/** 리포트 안 채권·채무 시트 이름 — 다시 올리면 이름 끝 기준년월로 자동 선택 (selectLedgerSheet) */
export const REPORT_LEDGER_PREFIX = "채권·채무 ";
export const REPORT_LEDGER_DETAIL = "채권·채무 상세";

/** 파일 이름·기록의 기간: 목표 대비 실적은 늘 연도 */
const filePeriodOf = (kind: ExportKind, period: Period): Period =>
  kind === "targets" ? { unit: "year", year: period.year } : period;

export type ExportKind = keyof typeof KINDS;

export type ManagementExportFile = {
  kind: ExportKind;
  body: Buffer;
  fileName: string;
  asciiName: string;
  period: string;
  sheetNames: string[];
};

const isKind = (v: string | null): v is ExportKind =>
  v !== null && Object.hasOwn(KINDS, v);

/** 파일 만들기만 (기록 없음) — 다운로드와 검산 스크립트(npm run export:report)가 같은 함수를 쓴다 */
export async function buildExportFile(
  kind: ExportKind,
  period: Period,
  thisMonth: { year: number; month: number },
  today: Date,
  now: Date,
  author: string,
) {
  switch (kind) {
    case "report": {
      const year: Period = { unit: "year", year: period.year };
      const months = monthsUpTo(period, thisMonth);
      const range = trendRange(period).map(monthIndex);
      const [template, input, yearInput, trendMonths, ledgerByMonth] =
        await Promise.all([
          readExportTemplate(),
          loadSummaryInput(period, today),
          loadSummaryInput(year, today),
          loadFinanceMonths(range[0], range.at(-1)!),
          loadLedgerRowsByMonth(months),
        ]);
      const summary = computeManagementSummary(input);
      const report = buildReportLayout({
        summary,
        yearSummary: computeManagementSummary(yearInput),
        yearMonths: yearInput.financeMonths,
        trend: computeTrend(
          period,
          trendMonths,
          today,
          DEFAULT_METRICS_SETTINGS.costMode,
        ),
        today,
        writtenOn: today.toISOString().slice(0, 10),
        author,
      });
      const ledger = planExportSheets(
        period,
        months,
        (ym) => ledgerByMonth.get(formatLedgerMonth(ym)) ?? [],
      ).map((s) => ({
        ...s,
        sheetName: `${REPORT_LEDGER_PREFIX}${s.sheetName}`,
      }));
      const list = receivablesListSheet(summary.receivables);
      const name = periodSheetName(period);
      return {
        body: await buildStackedWorkbook({
          template,
          sheets: [
            {
              name,
              layout: report.layout,
              maxAux: report.maxAux,
              print: { blocks: report.blocks },
            },
          ],
          ledger: { sheets: ledger, detailName: REPORT_LEDGER_DETAIL },
          lists: [list],
          now,
        }),
        sheetNames: [
          name,
          ...ledger.map((s) => s.sheetName),
          REPORT_LEDGER_DETAIL,
          list.name,
        ],
      };
    }
    case "targets": {
      const year: Period = { unit: "year", year: period.year };
      const [template, input] = await Promise.all([
        readExportTemplate(),
        loadSummaryInput(year, today),
      ]);
      const summary = computeManagementSummary(input);
      const sheet = buildTargetsLayout({
        summary,
        months: input.financeMonths,
        today,
      });
      const name = periodSheetName(year);
      return {
        body: await buildStackedWorkbook({
          template,
          sheets: [{ name, layout: sheet.layout, maxAux: sheet.maxAux }],
          now,
        }),
        sheetNames: [name],
      };
    }
    case "receivables": {
      const [template, input] = await Promise.all([
        readExportTemplate(),
        loadSummaryInput(period, today),
      ]);
      const { receivables } = computeManagementSummary(input);
      const sheet = buildReceivablesLayout(receivables);
      const list = receivablesListSheet(receivables);
      const name = periodSheetName(period);
      return {
        body: await buildStackedWorkbook({
          template,
          sheets: [{ name, layout: sheet.layout, maxAux: sheet.maxAux }],
          lists: [list],
          now,
        }),
        sheetNames: [name, list.name],
      };
    }
    case "entry": {
      const months = monthsUpTo(period, thisMonth);
      const [template, loaded] = await Promise.all([
        readExportTemplate(),
        loadEntryExportData(months),
      ]);
      const sheets = planEntrySheets({ period, months, ...loaded });
      return {
        body: await buildEntryWorkbook({ template, sheets, now }),
        sheetNames: sheets.map((s) => s.sheetName),
      };
    }
  }
}

export async function exportManagementFile(
  kindParam: string | null,
  periodParam: string | null,
  actor: { id: string; loginId: string; name?: string },
): Promise<ManagementExportFile> {
  if (!isKind(kindParam)) {
    throw new ManagementExportError(400, "내려받을 화면이 올바르지 않습니다.");
  }
  const period = parseExportPeriod(periodParam);
  if (!period) {
    throw new ManagementExportError(
      400,
      "기간 형식이 올바르지 않습니다. (예: 2026-10, 2026-Q3, 2026, 2026-YTD10)",
    );
  }
  const today = await getTodayKst();
  const thisMonth = {
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
  };
  if (monthsUpTo(period, thisMonth).length === 0) {
    throw new ManagementExportError(400, "미래 기간은 내려받을 수 없습니다.");
  }

  const def = KINDS[kindParam];
  const now = await getNow();
  const { body, sheetNames } = await buildExportFile(
    kindParam,
    period,
    thisMonth,
    today,
    now,
    actor.name ?? actor.loginId,
  );
  const filePeriod = filePeriodOf(kindParam, period);
  const param = toPeriodParam(filePeriod);
  const names = exportFileName(def.file, filePeriod);

  try {
    await recordAudit(prisma, {
      occurredAt: now,
      actor: { id: actor.id, loginId: actor.loginId },
      area: "management",
      screen: def.screen,
      action: "EXPORT",
      target: {
        type: def.targetType,
        id: param,
        label: `${def.label} · ${param}`,
      },
      meta: {
        period: param,
        fileName: names.fileName,
        sheets: sheetNames,
        sheetCount: sheetNames.length,
      },
    });
  } catch (error) {
    console.error(`[mgmt-export] 다운로드 기록 실패 kind=${kindParam}`, error);
    throw new ManagementExportError(
      503,
      "다운로드 기록을 남기지 못해 다운로드를 막았습니다. 잠시 후 다시 시도하세요.",
    );
  }
  return { kind: kindParam, body, ...names, period: param, sheetNames };
}
