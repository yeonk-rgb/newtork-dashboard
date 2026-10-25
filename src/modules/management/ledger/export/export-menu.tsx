"use client";
// 채권·채무 [엑셀 다운로드 ▾] 당월·분기·연간 — 메뉴 모양·내려받기는 경영지원 다운로드 공용 부품
import { DownloadMenu } from "../../export/download-menu";
import { parseLedgerMonth } from "../rules";
import { exportPeriodsFor } from "./period";

export function ExportMenu({ month }: { month: string }) {
  const ym = parseLedgerMonth(month);
  if (!ym) return null;
  return (
    <DownloadMenu
      items={exportPeriodsFor(ym).map((p) => ({
        label: p.label,
        href: `/api/management/ledger/export?period=${encodeURIComponent(p.param)}`,
        fileName: `경영지원_관리_${p.param}.xlsx`,
        fallbackName: `ledger-${p.param}.xlsx`,
      }))}
    />
  );
}
