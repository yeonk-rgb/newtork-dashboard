// CSV 내려받기 (친구 utils/download.js downloadCsv) — 엑셀에서 한글 안 깨지게 BOM
export function downloadCsv<T>(
  fileName: string,
  columns: { label: string; value: (r: T) => string | number | null }[],
  rows: T[],
) {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    columns.map((c) => cell(c.label)).join(","),
    ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(",")),
  ];
  const url = URL.createObjectURL(
    new Blob([`﻿${lines.join("\r\n")}\r\n`], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
