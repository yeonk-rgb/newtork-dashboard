"use client";
// [월별 리포트 엑셀] — 메인 대시보드·경영지원 상세의 기간 선택 옆, 지금 보고 있는 기간 그대로 (서버가 can() 으로 다시 확인)
import type { Period } from "@/shared/period/period";
import { toPeriodParam } from "@/shared/period/url";

import { DownloadButton } from "./download-menu";
import { exportFileName } from "./period";

export function ReportDownloadButton({ period }: { period: Period }) {
  const param = toPeriodParam(period);
  const names = exportFileName({ ko: "리포트", ascii: "report" }, period);
  return (
    <DownloadButton
      label="월별 리포트 엑셀"
      item={{
        label: "월별 리포트 엑셀",
        href: `/api/management/export?kind=report&period=${encodeURIComponent(param)}`,
        fileName: names.fileName,
        fallbackName: names.asciiName,
      }}
    />
  );
}
