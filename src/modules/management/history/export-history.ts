// 변경 이력 엑셀 내려받기 (server-only) — 관리자(대표)만, 지금 필터 그대로, 내려받은 것도 기록
// 기록을 남기지 못하면 내려받기도 막는다 (경영지원 관리 다운로드와 같은 방식)
import "server-only";

import type { AppUser } from "@/shared/auth/types";
import { recordAudit } from "@/shared/audit/record";
import { prisma } from "@/shared/db/client";

import { auditActor } from "../audit-fields";
import { getNow, getTodayKst } from "../data/load-summary-input";
import {
  ExportTemplateMissingError,
  readExportTemplate,
} from "../export/template";
import { buildHistoryWorkbook } from "./build-history-workbook";
import { HistoryTooManyRowsError, loadHistoryForExport } from "./load-history";
import { historyAbilities, historyFileName, parseHistoryFilter } from "./rules";

export class HistoryExportError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type HistoryExportFile = {
  body: Buffer;
  fileName: string;
  /** Content-Disposition filename= (한글을 못 읽는 프로그램용) */
  asciiName: string;
  rowCount: number;
};

export async function exportHistory(
  params: URLSearchParams,
  user: AppUser,
): Promise<HistoryExportFile> {
  const abilities = historyAbilities(user);
  if (!abilities.canExport) {
    throw new HistoryExportError(
      403,
      "변경 이력 내려받기는 관리자(대표)만 할 수 있습니다.",
    );
  }
  const today = await getTodayKst();
  // 쪽(page)은 무시하고 필터에 맞는 기록 전부
  const filter = parseHistoryFilter(Object.fromEntries(params), today);
  let rows;
  try {
    rows = await loadHistoryForExport(filter, abilities);
  } catch (error) {
    if (error instanceof HistoryTooManyRowsError) {
      throw new HistoryExportError(400, error.message);
    }
    throw error;
  }
  const fileName = historyFileName(filter);
  let template: Buffer;
  try {
    template = await readExportTemplate();
  } catch (error) {
    if (error instanceof ExportTemplateMissingError) {
      console.error(`[history-export] 양식 파일 없음: ${error.filePath}`);
      throw new HistoryExportError(503, error.message);
    }
    throw error;
  }
  const now = await getNow();
  const body = await buildHistoryWorkbook(rows, "변경 이력", { template, now });

  try {
    await recordAudit(prisma, {
      occurredAt: now,
      actor: auditActor(user),
      area: "admin",
      screen: "history-export",
      action: "EXPORT",
      target: {
        type: "AuditLogExport",
        id: `${filter.from}_${filter.to}`,
        label: `변경 이력 엑셀 내려받기 · ${filter.from} ~ ${filter.to}`,
      },
      meta: {
        from: filter.from,
        to: filter.to,
        rows: rows.length,
        fileName,
        filters: {
          actorId: filter.actorId,
          screen: filter.screen,
          action: filter.action,
          q: filter.q,
        },
      },
    });
  } catch (error) {
    console.error("[history-export] 내려받기 기록 실패", error);
    throw new HistoryExportError(
      503,
      "내려받기 기록을 남기지 못해 내려받기를 막았습니다. 잠시 후 다시 시도하세요.",
    );
  }

  return {
    body,
    fileName,
    asciiName: `audit-log_${filter.from}_${filter.to}.xlsx`,
    rowCount: rows.length,
  };
}
