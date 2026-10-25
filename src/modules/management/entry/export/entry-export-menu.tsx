"use client";
// 월간 입력 [엑셀 다운로드 ▾] 당월·분기·연간·연초 누적 — 저장된 값 기준 (입력 중인 값은 저장 후 반영)
import { toPeriodParam } from "@/shared/period/url";

import { DownloadMenu } from "../../export/download-menu";
import { exportFileName, exportMenuPeriods } from "../../export/period";

export function EntryExportMenu({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  return (
    <DownloadMenu
      menuWidthClass="w-80"
      note="저장된 값으로 만듭니다. 합계 시트는 확정된 달만 더합니다."
      items={exportMenuPeriods({ year, month }).map(({ label, period }) => {
        const param = toPeriodParam(period);
        const names = exportFileName(
          { ko: "월간입력", ascii: "entry" },
          period,
        );
        return {
          label,
          href: `/api/management/export?kind=entry&period=${encodeURIComponent(param)}`,
          fileName: names.fileName,
          fallbackName: names.asciiName,
        };
      })}
    />
  );
}
