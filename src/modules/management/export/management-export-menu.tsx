"use client";
// 경영지원 [엑셀 다운로드 ▾] — 화면이 고른 기간 목록으로 /api/management/export?kind=&period= 를 받는다 (권한은 서버가 can() 으로 다시 확인)
import type { Period } from "@/shared/period/period";
import { toPeriodParam } from "@/shared/period/url";

import { DownloadMenu } from "./download-menu";
import { exportFileName } from "./period";

export function ManagementExportMenu({
  kind,
  file,
  options,
  note,
}: {
  kind: "entry" | "targets" | "receivables";
  file: { ko: string; ascii: string };
  options: { label: string; period: Period; fileLabel?: Period }[];
  note?: string;
}) {
  return (
    <DownloadMenu
      menuWidthClass="w-80"
      note={note}
      items={options.map(({ label, period, fileLabel }) => {
        const param = toPeriodParam(period);
        const names = exportFileName(file, fileLabel ?? period);
        return {
          label,
          href: `/api/management/export?kind=${kind}&period=${encodeURIComponent(param)}`,
          fileName: names.fileName,
          fallbackName: names.asciiName,
        };
      })}
    />
  );
}
