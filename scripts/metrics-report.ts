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
import {
  dashboardKpis,
  expenseMixDonut,
  targetCardModel,
} from "@/modules/management/components/dashboard/model";
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
import { parsePeriodParam } from "@/shared/period/url";

function parsePeriod(args: string[]): Period {
  // 화면 주소와 같은 형식도 받는다: 2026-Q3 | 2026-08 | 2026 | 2026-YTD09
  if (args.length === 1 && args[0].includes("-")) {
    const p = parsePeriodParam(args[0]);
    if (!p) throw new Error(`기간 형식이 올바르지 않습니다: ${args[0]}`);
    return p;
  }
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

  const b = s.breakEven;
  const classText = (i: (typeof b.items)[number]) =>
    i.basis === "unclassified"
      ? "미분류 → 고정비"
      : i.costClass === "FIXED"
        ? "고정비"
        : "변동비";
  out.push(
    `\n## 손익분기점(BEP)${b.appliedBasis.length > 0 ? " — 적용 기준" : ""}\n\n${table(
      ["항목", "구분", "금액", "분류 근거"],
      [
        ...b.items.map((i) => [
          i.label,
          classText(i),
          won(i.amount),
          i.basis === "category" ? "항목 설정" : "적용 기준",
        ]),
        ["**변동비 합계**", "", `**${won(b.variableCost)}**`, ""],
        ["**고정비 합계**", "", `**${won(b.fixedCost)}**`, ""],
      ],
    )}\n\n${table(
      ["항목", "값"],
      [
        ["매출", won(b.revenue)],
        ["공헌이익 (매출 − 변동비)", won(b.contribution)],
        ["공헌이익률", pct(b.contributionRatio)],
        [
          "BEP 매출 (고정비 × 매출 ÷ 공헌이익, 올림)",
          b.bepRevenue === null ? "-" : won(b.bepRevenue),
        ],
        ["달성률 (공헌이익 ÷ 고정비)", pct(b.rate)],
        ["실제 매출 − BEP 매출", b.gap === null ? "-" : won(b.gap)],
        ["계산 불가 사유", b.reason ?? "-"],
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

  // 월 목표 = 분기 목표 ÷ 3 자동 (2026-10-25 A안). 월 보기면 그 분기 3개월, 아니면 기간 안의 달
  if (t.monthTargets) {
    const shownMonths =
      period.unit === "month"
        ? [0, 1, 2].map((i) => (Math.ceil(period.month / 3) - 1) * 3 + 1 + i)
        : periodMonths(period)
            .filter((m) => m.year === period.year)
            .map((m) => m.month);
    const confirmedRevenue = (month: number) => {
      const m = input.financeMonths.find(
        (x) =>
          x.year === period.year &&
          x.month === month &&
          x.status === "CONFIRMED",
      );
      return m ? m.productSales + m.goodsSales + m.serviceSales : null;
    };
    out.push(
      `\n## 월 목표·월 달성률 (월 목표 = 분기 목표 ÷ 3 자동, 나머지 원은 분기 마지막 달)\n\n${table(
        ["월", "월 목표", "확정 매출", "월 달성률"],
        shownMonths.map((month) => {
          const target = t.monthTargets![month - 1];
          const actual = confirmedRevenue(month);
          return [
            `${month}월`,
            won(target),
            actual === null ? "미확정" : won(actual),
            actual === null || target === 0n
              ? "-"
              : pct(Number(actual) / Number(target)),
          ];
        }),
      )}` +
        (t.month
          ? `\n\n선택한 달(${t.month.month}월): 목표 ${won(t.month.target)} · 실적 ${won(t.month.actual)} · 달성률 ${pct(t.month.rate)}`
          : ""),
    );
  }

  // 메인 대시보드 새 구성 표시 모델 (화면에 넘길 값 — summary 값 그대로)
  const kpis = dashboardKpis(s);
  const card = targetCardModel(s, input.today);
  const mix = expenseMixDonut(s);
  out.push(
    `\n## 대시보드 표시 모델 (메인 재구성)\n\n${table(
      ["KPI", "값", "아래 줄", "비교"],
      kpis.map((k) => [
        k.title,
        won(k.value) + (k.warn ? " (빨강)" : ""),
        k.sub ?? "",
        k.deltas === null
          ? "-"
          : k.deltas.rows
              .map(
                (r) =>
                  `${r.label} ${
                    r.value === null
                      ? "-"
                      : k.deltas!.kind === "amount"
                        ? `${(r.value as bigint) >= 0n ? "▲" : "▼"}${won((r.value as bigint) < 0n ? -(r.value as bigint) : (r.value as bigint))}원`
                        : pct(r.value as number)
                  }`,
              )
              .join(" / "),
      ]),
    )}\n\n목표매출 달성률 카드: 가운데 ${card.donut.center.value} (${card.donut.center.label})${card.note ? ` · ${card.note}` : ""}${card.quarterProgress ? ` · ${card.quarterProgress.label} ${pct(card.quarterProgress.rate)}` : ""}\n\n` +
      `분기별: ${card.quarters.map((q) => `${q.quarter}분기 ${pct(q.rate)}(${q.state}${q.warn ? ", 빨강" : ""}${q.unconfirmedMonths.length ? `, 미확정 ${q.unconfirmedMonths.join("·")}월` : ""})`).join(" / ") || "-"}\n\n` +
      `### 지출 구성 (조각 4개, 합 = 총지출 ${won(s.expenses.total)})\n\n${table(
        ["조각", "금액", "비중"],
        mix.donut.slices.map((x) => [
          x.label + (mix.sliceHints[x.key] ? ` ${mix.sliceHints[x.key]}` : ""),
          won(BigInt(x.value)),
          s.expenses.total === 0n
            ? "-"
            : pct(Number(x.value) / Number(s.expenses.total)),
        ]),
      )}\n\n#### 기타 항목별 (펼침)\n\n${table(
        ["항목", "금액"],
        mix.otherItems.map((i) => [i.label, won(BigInt(i.amount))]),
      )}`,
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

  // 미수금 = 경영지원 관리 외상매출금 기준월 (2026-10-26, 05-22)
  const r = s.receivables;
  out.push(
    `\n## 미수금 (경영지원 관리 외상매출금 ${r.month ? yearMonthLabel(r.month) : "입력 없음"}, 기준일 ${r.asOf.toISOString().slice(0, 10)})\n\n미수 ${won(r.total)}원 = 장기 미수금 ${won(r.longOverdue.amount)}원(${r.longOverdue.count}건) + 당월 수금예정 ${won(r.scheduled.amount)}원(${r.scheduled.count}건) · 당월 수금 ${won(r.collected.amount)}원(${r.collected.count}건, 미수금 아님)\n\n${table(
      ["순위", "거래처", "금액", "건수", "그중 장기 미수금"],
      r.byCustomer.map((x, i) => [
        i + 1,
        x.customerName,
        won(x.amount),
        x.count,
        won(x.longOverdue),
      ]),
    )}\n\n${table(
      ["수금 예정 (당월 수금예정 행)", "금액", "건수"],
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
