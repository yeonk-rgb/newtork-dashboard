"use client";
// 서비스팀 실적 표(월별·분기별·연간) CSV — 친구 exportCsv 그대로 (엑셀에서 한글 안 깨지게 BOM)
import { Download } from "lucide-react";

import { buttonSecondaryClass } from "@/shared/ui/styles";

export type ServiceCsvRow = {
  label: string;
  trips: number;
  paid: number;
  free: number;
  billingUnset: number;
  /** 소수 1자리 % 또는 "" */
  paidRatio: string;
  productQty: number;
  reportsWithParts: number;
};

export function ServiceCsvButton({
  fileName,
  rows,
}: {
  fileName: string;
  rows: ServiceCsvRow[];
}) {
  const download = () => {
    const header = [
      "기간",
      "출장 건수",
      "유상",
      "무상",
      "미입력",
      "유상 비율(%)",
      "수리 제품(대)",
      "부품 사용 보고서",
    ];
    const lines = rows.map((r) =>
      [
        r.label,
        r.trips,
        r.paid,
        r.free,
        r.billingUnset,
        r.paidRatio,
        r.productQty,
        r.reportsWithParts,
      ].join(","),
    );
    const blob = new Blob(
      [`﻿${[header.join(","), ...lines].join("\r\n")}\r\n`],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" onClick={download} className={buttonSecondaryClass}>
      <Download className="size-4" aria-hidden />
      실적 표 다운로드
    </button>
  );
}
