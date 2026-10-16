// 검산용: 시드(로컬 DB) 데이터로 지표를 계산해 마크다운 표로 출력
// 실행: npm run metrics:report -- 2026 Q3      (분기)
//       npm run metrics:report -- 2026 9       (월)
//       npm run metrics:report -- 2026         (연간)
//       npm run metrics:report -- 2026 ytd9    (1~9월 누적)
import "dotenv/config";

import {
  loadSummaryInput,
  todayKst,
} from "@/modules/management/data/load-summary-input";
import { computeManagementSummary } from "@/modules/management/metrics/summary";
import type { Change, FinanceMonth } from "@/modules/management/metrics/types";
import { prisma } from "@/shared/db/client";
import { formatAmount } from "@/shared/format/money";
import {
  monthIndex,
  periodMonths,
  previousPeriod,
  samePeriodLastYear,
  yearMonthLabel,
  type Period,
  type Quarter,
} from "@/shared/period/period";

function parsePeriod(args: string[]): Period {
  const [yearArg, spec] = args;
  const year = Number(yearArg);
  if (!Number.isInteger(year))
    throw new Error("사용법: <연도> [Q1~Q4 | 1~12 | ytd1~ytd12]");
  if (!spec) return { unit: "year", year };
  if (/^q[1-4]$/i.test(spec))
    return { unit: "quarter", year, quarter: Number(spec[1]) as Quarter };
  if (/^ytd\d+$/i.test(spec))
    return { unit: "ytd", year, month: Number(spec.slice(3)) };
  return { unit: "month", year, month: Number(spec) };
}

const won = (v: bigint) => formatAmount(v);
const pct = (v: number | null) =>
  v === null ? "—" : `${(v * 100).toFixed(2)}%`;
const change = (c: Change) =>
  c.rate === null ? `— (${c.reason})` : pct(c.rate);
const table = (headers: string[], rows: (string | number)[][]) =>
  [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");

function rawTable(months: FinanceMonth[]) {
  const categories = [
    ...new Map(
      months
        .flatMap((m) => m.otherExpenses)
        .map((e) => [e.categoryId, e] as const),
    ).values(),
  ].sort((a, b) => a.sortOrder - b.sortOrder);
  return table(
    [
      "월",
      "상태",
      "제품매출",
      "상품매출",
      "용역매출",
      "상품매입",
      "원재료매입",
      "경비",
      ...categories.map((c) => c.name),
    ],
    months.map((m) => [
      yearMonthLabel(m),
      m.status,
      won(m.productSales),
      won(m.goodsSales),
      won(m.serviceSales),
      won(m.goodsPurchase),
      won(m.materialPurchase),
      won(m.operatingExpense),
      ...categories.map((c) =>
        won(
          m.otherExpenses.find((e) => e.categoryId === c.categoryId)?.amount ??
            0n,
        ),
      ),
    ]),
  );
}

async function main() {
  const period = parsePeriod(process.argv.slice(2));
  // Next 요청 밖(스크립트)이라 connection() 없이 현재 시각을 직접 넘긴다
  const input = await loadSummaryInput(period, todayKst(new Date()));
  const s = computeManagementSummary(input);

  // 원 데이터: 기간 + 직전 + 전년 동기 월만
  const shown = new Set(
    [period, previousPeriod(period), samePeriodLastYear(period)]
      .flatMap(periodMonths)
      .map(monthIndex),
  );
  const raw = input.financeMonths.filter((m) => shown.has(monthIndex(m)));

  const out: string[] = [];
  out.push(
    `# ${s.label} 지표 (오늘 ${input.today.toISOString().slice(0, 10)})`,
  );
  out.push(`\n## 월별 원 데이터 (단위: 원)\n\n${rawTable(raw)}`);

  out.push(
    `\n## 집계 대상\n\n- 확정 월: ${s.confirmation.confirmedMonths.map(yearMonthLabel).join(", ") || "없음"}` +
      `\n- 미확정 월: ${s.confirmation.unconfirmedMonths.map((m) => `${yearMonthLabel(m)}(${m.reason})`).join(", ") || "없음"}` +
      `\n- 마감 전 월: ${s.confirmation.pendingMonths.map(yearMonthLabel).join(", ") || "없음"}`,
  );

  out.push(
    `\n## 매출\n\n${table(
      ["항목", "금액", "비율"],
      [
        ...s.revenue.items.map((i) => [i.label, won(i.amount), pct(i.ratio)]),
        ["**총매출**", `**${won(s.revenue.total)}**`, "100%"],
      ],
    )}`,
  );
  out.push(
    `\n## 지출\n\n${table(
      ["항목", "금액", "총지출 대비"],
      [
        ...s.expenses.items.map((i) => [i.label, won(i.amount), pct(i.ratio)]),
        ...s.expenses.otherItems.map((i) => [
          `└ ${i.label}`,
          won(i.amount),
          pct(i.ratio),
        ]),
        ["**총지출**", `**${won(s.expenses.total)}**`, "100%"],
      ],
    )}`,
  );
  out.push(
    `\n## 이익 (비용 기준: ${s.profit.costMode})\n\n${table(
      ["항목", "값"],
      [
        ["총매출", won(s.revenue.total)],
        ["비용", won(s.profit.cost)],
        ["단순 이익", won(s.profit.profit)],
        ["이익률", pct(s.profit.margin)],
      ],
    )}`,
  );

  const t = s.targets;
  out.push(
    `\n## 목표 달성률\n\n${
      t.annual === null
        ? "목표 미설정"
        : table(
            ["구분", "목표", "실적(확정)", "달성률"],
            [
              [
                "연간 (1월~기간 끝)",
                won(t.annual.target),
                won(t.annual.actual),
                pct(t.annual.rate),
              ],
              ...(t.period
                ? [
                    [
                      `기간 (${t.period.kind})`,
                      won(t.period.target),
                      won(t.period.actual),
                      pct(t.period.rate),
                    ],
                  ]
                : []),
            ],
          ) +
          `\n\n분기 목표: ${t.quarterTargets!.quarters.map((q, i) => `${i + 1}Q ${won(q)}(${t.quarterTargets!.sources[i]})`).join(" / ")}` +
          (t.quarterTargets!.warning ? ` ⚠️ ${t.quarterTargets!.warning}` : "")
    }`,
  );

  const c = s.changes;
  out.push(
    `\n## 증감률\n\n${table(
      [
        "비교 대상",
        "비교 범위",
        "매출",
        "지출",
        "이익",
        "비교 기간 미확정 포함",
      ],
      [c.previous, c.lastYear].map((x) => [
        x.label,
        x.aligned
          ? `${x.aligned.current.map(yearMonthLabel).join(",")} ↔ ${x.aligned.base.map(yearMonthLabel).join(",")}`
          : "기간 전체",
        change(x.revenue),
        change(x.expense),
        change(x.profit),
        x.isPartial ? "예" : "아니오",
      ]),
    )}`,
  );

  const r = s.receivables;
  out.push(
    `\n## 미수금 (기준일 ${r.asOf.toISOString().slice(0, 10)})\n\n총 ${won(r.total)}원 / ${r.count}건\n\n${table(
      ["순위", "거래처", "금액", "건수"],
      r.byCustomer.map((x, i) => [
        i + 1,
        x.customerName,
        won(x.amount),
        x.count,
      ]),
    )}\n\n${table(
      ["경과일(발생일 기준)", "금액", "건수"],
      r.aging.map((a) => [a.bucket, won(a.amount), a.count]),
    )}\n\n${table(
      ["수금 예정", "금액", "건수"],
      [
        [
          "예정일 지남",
          won(r.expected.overdue.amount),
          r.expected.overdue.count,
        ],
        ...r.expected.months.map((m) => [
          yearMonthLabel(m),
          won(m.amount),
          m.count,
        ]),
        ["그 이후", won(r.expected.later.amount), r.expected.later.count],
        [
          "예정일 없음",
          won(r.expected.noDueDate.amount),
          r.expected.noDueDate.count,
        ],
      ],
    )}`,
  );

  console.log(out.join("\n"));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
