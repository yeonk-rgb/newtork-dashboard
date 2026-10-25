// 검산용 (읽기만): 로컬 DB 로 경영지원 엑셀을 만들어
//  ① 원본 양식과 셀 단위 비교표  ② 엑셀 숫자 ↔ 대시보드 화면 숫자(computeManagementSummary·표시 모델)  를 마크다운으로 출력하고
//  ③ 만든 파일을 저장한다 (원본과 나란히 열어 보기·스크린샷용). DB 에 쓰지 않고 변경 기록도 남기지 않는다
// 실행: npm run export:report -- [entry|targets|receivables] <기간> [저장 폴더]
//       (종류를 빼면 entry. 기간: 2026-09 | 2026-Q3 | 2026 | 2026-YTD09 — targets 는 그 해 시트 1장)
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
import {
  dashboardKpis,
  targetCardModel,
} from "@/modules/management/components/dashboard/model";
import { stackedComparison } from "@/modules/management/export/compare-stacked";
import { periodSheetName } from "@/modules/management/export/period";
import { buildStackedWorkbook } from "@/modules/management/export/stacked";
import {
  buildReceivablesLayout,
  receivablesListSheet,
} from "@/modules/management/receivables/export/receivables-layout";
import { buildTargetsLayout } from "@/modules/management/settings/export/targets-layout";
import { prisma } from "@/shared/db/client";
import { formatAmount } from "@/shared/format/money";
import type { Period } from "@/shared/period/period";
import { toPeriodParam } from "@/shared/period/url";

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "-" : `${(v * 100).toFixed(1)}%`;

/** 목표 대비 실적·미수금: 공용 쌓기형 엔진으로 만들어 비교표 + 엑셀 숫자 ↔ 대시보드 숫자 */
async function stackedReport(
  kind: "targets" | "receivables",
  period: Period,
  outDir: string,
) {
  const today = todayKst(new Date());
  const template = await readFile(TEMPLATE_RELATIVE_PATH);
  const sheetPeriod: Period =
    kind === "targets" ? { unit: "year", year: period.year } : period;
  const input = await loadSummaryInput(sheetPeriod, today);
  const summary = computeManagementSummary(input);
  const name = periodSheetName(sheetPeriod);
  const built =
    kind === "targets"
      ? buildTargetsLayout({ summary, months: input.financeMonths, today })
      : buildReceivablesLayout(summary.receivables);
  const buf = await buildStackedWorkbook({
    template,
    sheets: [{ name, layout: built.layout, maxAux: built.maxAux }],
    lists:
      kind === "receivables" ? [receivablesListSheet(summary.receivables)] : [],
    now: new Date(),
  });
  const file = exportFileName(
    kind === "targets"
      ? { ko: "목표실적", ascii: "targets" }
      : { ko: "미수금", ascii: "receivables" },
    sheetPeriod,
  );
  await mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, file.fileName);
  await writeFile(filePath, buf);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const tpl = new ExcelJS.Workbook();
  await tpl.xlsx.load(template as unknown as ArrayBuffer);
  const rows = [
    ...comparePackage(
      await readPackageParts(template),
      await readPackageParts(buf),
    ),
    ...stackedComparison(tpl.worksheets[0], wb, name, built.layout),
  ];
  const count = (r: string) => rows.filter((x) => x.result === r).length;
  console.log(
    `# ${kind === "targets" ? "목표 대비 실적" : "미수금 통계"} 엑셀 검산 — ${toPeriodParam(period)}\n\n파일: ${filePath}\n시트: ${wb.worksheets.map((w) => w.name).join(", ")}\n`,
  );
  console.log(
    `## ① 원본 ↔ 새 파일 셀 단위 비교\n\n같음 ${count("같음")} · 의도한 차이 ${count("의도한 차이")} · **의도하지 않은 차이 ${unintended(rows).length}**\n`,
  );
  console.log(toMarkdown(rows.filter((r) => r.result !== "같음")));

  const ws = wb.getWorksheet(name)!;
  const cellText = (r: number, c: number) =>
    String(ws.getCell(r, c).value ?? "");
  const findRow = (text: string) => {
    for (let r = 1; r <= ws.rowCount; r++)
      if (cellText(r, 3) === text) return r;
    return -1;
  };
  console.log(`\n## ② 엑셀 숫자 = 대시보드 화면 숫자\n`);
  console.log("| 항목 | 엑셀 | 대시보드 | 결과 |\n|---|---:|---:|---|");
  const line = (label: string, excel: string, screen: string) =>
    console.log(
      `| ${label} | ${excel} | ${screen} | ${excel === screen ? "같음" : "**다름**"} |`,
    );
  if (kind === "targets") {
    // 분기: 그 분기 첫 달 행의 F(분기 합계) ÷ 연간 목표 블록의 "N분기 목표" D
    for (const q of [1, 2, 3, 4] as const) {
      const first = findRow(`${(q - 1) * 3 + 1}월`);
      const actual = Number(ws.getCell(first, 6).result ?? 0);
      const target = Number(ws.getCell(findRow(`${q}분기 목표`), 4).value ?? 0);
      const screen = computeManagementSummary(
        await loadSummaryInput(
          { unit: "quarter", year: period.year, quarter: q },
          today,
        ),
      );
      const card = targetCardModel(screen, today);
      line(
        `${q}분기 목표 달성률 (메모: ${cellText(first + 1, 8)})`,
        pct(target ? actual / target : null),
        card.donut.center.value,
      );
    }
    // 월: 그 달 D ÷ 적요 "월 목표 N (분기 ÷ 3)"
    const month = period.unit === "month" ? period.month : 8;
    const r = findRow(`${month}월`);
    const target = Number(
      cellText(r, 5)
        .match(/월 목표 ([\d,]+)/)?.[1]
        .replace(/,/g, "") ?? 0,
    );
    const actual = ws.getCell(r, 4).value;
    const ms = computeManagementSummary(
      await loadSummaryInput(
        { unit: "month", year: period.year, month },
        today,
      ),
    );
    line(
      `${month}월 목표 달성률 (월 목표 = 분기 ÷ 3)`,
      actual === null || !target ? "-" : pct(Number(actual) / target),
      targetCardModel(ms, today).donut.center.value,
    );
    const rateCell = (() => {
      for (let r2 = 1; r2 <= ws.rowCount; r2++)
        if (cellText(r2, 8) === "목표매출 달성률") return ws.getCell(r2, 9);
      return null;
    })();
    line(
      `${period.year}년 목표매출 달성률 (I열)`,
      pct(Number(rateCell?.result ?? 0)),
      targetCardModel(summary, today).donut.center.value,
    );
  } else {
    const kpi = dashboardKpis(summary)[3];
    const totals: number[] = [];
    ws.eachRow((row) => {
      if (row.getCell(6).formula) totals.push(Number(row.getCell(6).result));
    });
    let over90 = 0;
    ws.eachRow((row) => {
      if (row.getCell(8).value === "90일 초과")
        over90 = Number(row.getCell(9).result ?? row.getCell(9).value);
    });
    console.log(`제목: ${cellText(1, 3)} / 대시보드 KPI: ${kpi.title}\n`);
    line(
      "미수금 총액 (거래처별 F)",
      formatAmount(BigInt(totals.at(-1) ?? 0)),
      formatAmount(kpi.value),
    );
    line(
      "미수금 총액 (경과일 그룹 F 4개 합)",
      formatAmount(BigInt(totals.slice(0, 4).reduce((a, b) => a + b, 0))),
      formatAmount(kpi.value),
    );
    line(
      "90일 초과 (I열)",
      formatAmount(BigInt(over90)),
      formatAmount(kpi.details![0].amount),
    );
    line(
      "건수",
      `${wb.getWorksheet("미수금 상세")!.rowCount - 1}건`,
      kpi.sub ?? "",
    );
  }
}

const KINDS = ["entry", "targets", "receivables"] as const;
type Kind = (typeof KINDS)[number];

async function main() {
  const args = process.argv.slice(2);
  const kind: Kind = (KINDS as readonly string[]).includes(args[0])
    ? (args.shift() as Kind)
    : "entry";
  const [param, outDir = "."] = args;
  const period = parseExportPeriod(param ?? null);
  if (!period)
    throw new Error(
      "사용법: npm run export:report -- [entry|targets|receivables] <기간> [저장 폴더]",
    );
  if (kind === "entry") return entryReport(period, outDir);
  return stackedReport(kind, period, outDir);
}

async function entryReport(period: Period, outDir: string) {
  const param = toPeriodParam(period);
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
