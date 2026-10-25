// 검산용 (읽기만): 로컬 DB 로 월간 입력 엑셀을 만들어
//  ① 원본 양식과 셀 단위 비교표  ② 엑셀 블록 총액 ↔ 화면 숫자(computeManagementSummary)  를 마크다운으로 출력하고
//  ③ 만든 파일을 저장한다 (원본과 나란히 열어 보기·스크린샷용). DB 에 쓰지 않고 변경 기록도 남기지 않는다
// 실행: npm run export:report -- 2026-Q3 [저장 폴더]      (기간: 2026-09 | 2026-Q3 | 2026 | 2026-YTD09)
import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

import {
  loadSummaryInput,
  todayKst,
} from "@/modules/management/data/load-summary-input";
import { buildEntryWorkbook } from "@/modules/management/entry/export/build-entry-workbook";
import { entryComparison } from "@/modules/management/entry/export/compare-entry";
import { loadEntryExportData } from "@/modules/management/entry/export/load-entry-export";
import { planEntrySheets } from "@/modules/management/entry/export/plan";
import {
  comparePackage,
  toMarkdown,
  unintended,
} from "@/modules/management/export/compare";
import {
  exportFileName,
  monthsUpTo,
  parseExportPeriod,
} from "@/modules/management/export/period";
import { TEMPLATE_RELATIVE_PATH } from "@/modules/management/export/template";
import { readPackageParts } from "@/modules/management/export/testing/dump-workbook";
import { computeManagementSummary } from "@/modules/management/metrics/summary";
import { prisma } from "@/shared/db/client";
import { formatAmount } from "@/shared/format/money";

async function main() {
  const [param, outDir = "."] = process.argv.slice(2);
  const period = parseExportPeriod(param ?? null);
  if (!period)
    throw new Error("사용법: npm run export:report -- <기간> [저장 폴더]");
  const now = new Date();
  const today = todayKst(now);
  const months = monthsUpTo(period, {
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
  });
  const template = await readFile(TEMPLATE_RELATIVE_PATH);
  const sheets = planEntrySheets({
    period,
    months,
    ...(await loadEntryExportData(months)),
  });
  const buf = await buildEntryWorkbook({ template, sheets, now });
  const { fileName } = exportFileName(
    { ko: "월간입력", ascii: "entry" },
    period,
  );
  await mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, fileName);
  await writeFile(filePath, buf);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const tpl = new ExcelJS.Workbook();
  await tpl.xlsx.load(template as unknown as ArrayBuffer);
  const source = tpl.worksheets[0];

  console.log(
    `# 월간 입력 엑셀 검산 — ${param}\n\n파일: ${filePath}\n시트: ${sheets.map((s) => s.sheetName).join(", ")}\n`,
  );

  // ① 셀 단위 비교 (합계 시트가 있으면 합계 시트 + 첫 월 시트)
  const targets = [
    sheets[0],
    sheets.find((s, i) => i > 0 && s.kind === "month"),
  ].filter((s): s is (typeof sheets)[number] => !!s);
  const rows = [
    ...comparePackage(
      await readPackageParts(template),
      await readPackageParts(buf),
    ),
    ...targets.flatMap((s) => entryComparison(source, wb, s)),
  ];
  const count = (r: string) => rows.filter((x) => x.result === r).length;
  console.log(
    `## ① 원본 ↔ 새 파일 셀 단위 비교\n\n같음 ${count("같음")} · 의도한 차이 ${count("의도한 차이")} · **의도하지 않은 차이 ${unintended(rows).length}**\n`,
  );
  console.log(toMarkdown(rows.filter((r) => r.result !== "같음")));
  console.log(
    `\n<details><summary>같음 ${count("같음")}건 전체</summary>\n\n${toMarkdown(rows.filter((r) => r.result === "같음"))}\n\n</details>\n`,
  );

  // ② 엑셀 합계 = 화면 숫자 (첫 시트 = 당월 시트 또는 합계 시트)
  const s = computeManagementSummary(await loadSummaryInput(period, today));
  const ws = wb.getWorksheet(sheets[0].sheetName)!;
  const totals: Record<string, number> = {};
  let title = "";
  ws.eachRow((row) => {
    const c = row.getCell(3).value;
    if (row.getCell(3).font?.bold && typeof c === "string" && c !== "항목") {
      title = c.split(" (")[0];
    }
    if (row.getCell(6).formula) totals[title] = row.getCell(6).result as number;
  });
  const item = (key: string) =>
    s.expenses.items.find((i) => i.key === key)?.amount ?? 0n;
  const pairs: [string, number, bigint][] = [
    ["매출", totals["매출"], s.revenue.total],
    [
      "매입 (상품+원재료)",
      totals["매입"],
      item("goodsPurchase") + item("materialPurchase"),
    ],
    ["경비", totals["경비"], item("operatingExpense")],
    [
      "그 외 지출",
      totals["그 외 지출액(광고선전비, 접대비 등)"],
      item("otherExpense"),
    ],
    [
      "총지출 (매입+경비+그 외)",
      totals["매입"] +
        totals["경비"] +
        totals["그 외 지출액(광고선전비, 접대비 등)"],
      s.expenses.total,
    ],
  ];
  console.log(
    `## ② 엑셀 합계 = 화면 숫자 (${ws.name} 시트 ↔ 대시보드 ${s.label})\n`,
  );
  console.log(
    `화면 집계: 확정 ${s.confirmation.confirmedMonths.map((m) => `${m.month}월`).join("·") || "없음"}${s.confirmation.unconfirmedMonths.length ? ` / 제외 ${s.confirmation.unconfirmedMonths.map((m) => `${m.month}월`).join("·")}` : ""}\n`,
  );
  // 확정 안 된 달의 월 시트는 입력값 그대로(H1 빨간 안내), 화면은 그 달을 빼므로 비교 대상이 아님
  const excluded = sheets[0].kind === "month" && sheets[0].status.warn;
  if (excluded)
    console.log(
      `> ${sheets[0].status.text} — 엑셀 월 시트는 입력값 그대로, 화면 합계에서는 빠짐\n`,
    );
  console.log("| 항목 | 엑셀 F열 | 화면 | 결과 |\n|---|---:|---:|---|");
  for (const [label, excel, screen] of pairs) {
    const result = excluded
      ? "화면 제외 달"
      : BigInt(excel) === screen
        ? "같음"
        : "**다름**";
    console.log(
      `| ${label} | ${formatAmount(BigInt(excel))} | ${formatAmount(screen)} | ${result} |`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
