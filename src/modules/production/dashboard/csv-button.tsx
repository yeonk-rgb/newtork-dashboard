"use client";
// 실적 표(월별·분기별·연간) CSV 내려받기 — 화면에 받은 값 그대로 (엑셀에서 한글 안 깨지게 BOM)
import { Download } from "lucide-react";

import { buttonSecondaryClass } from "@/shared/ui/styles";

export type CsvRow = {
  label: string;
  target: number | null;
  confirmed: number;
  achievement: number | null;
  shortfall: number | null;
  unconfirmed: number;
};

export function CsvButton({
  fileName,
  rows,
}: {
  fileName: string;
  rows: CsvRow[];
}) {
  const download = () => {
    const header = [
      "기간",
      "목표",
      "확정 출고 수량",
      "달성률(%)",
      "부족 수량",
      "수량 미확정",
    ];
    const lines = rows.map((r) =>
      [
        r.label,
        r.target ?? "",
        r.confirmed,
        r.achievement === null ? "" : (r.achievement * 100).toFixed(1),
        r.shortfall ?? "",
        r.unconfirmed,
      ].join(","),
    );
    const blob = new Blob(
      [`﻿${[header.join(","), ...lines].join("\r\n")}\r\n`],
      {
        type: "text/csv;charset=utf-8",
      },
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
