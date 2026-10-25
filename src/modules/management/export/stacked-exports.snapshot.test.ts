// 목표 대비 실적·미수금 다운로드 결과물 고정 — 셀 값·수식·계산값·서식·병합·열·행·인쇄·문서 속성·테마
// 2026-10-26 엑셀 PR ③(종합 리포트)에서 배치 함수를 "이어 붙이기"로 바꾸기 직전 결과물로 만든 스냅샷.
// 바뀌면 의도한 변경인지 확인 후 `npx vitest run -u <이 파일>` 로 갱신한다 (공용 엔진만 손댔다면 갱신하지 말 것)
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { TEMPLATE_PATH } from "../ledger/import/test-helpers";
import { computeManagementSummary } from "../metrics/summary";
import {
  buildReceivablesLayout,
  receivablesListSheet,
} from "../receivables/export/receivables-layout";
import { buildTargetsLayout } from "../settings/export/targets-layout";
import { buildStackedWorkbook } from "./stacked";
import { dumpWorkbook } from "./testing/dump-workbook";
import { FIXTURE_TODAY, fixtureInput } from "./testing/summary-fixture";

const NOW = new Date("2026-10-25T03:00:00Z");

describe("목표 대비 실적·미수금 다운로드 결과물 스냅샷", () => {
  it("목표 2026 + 미수금 2026-Q3 + 미수금 상세", async () => {
    const yearInput = fixtureInput({ unit: "year", year: 2026 });
    const t = buildTargetsLayout({
      summary: computeManagementSummary(yearInput),
      months: yearInput.financeMonths,
      today: FIXTURE_TODAY,
    });
    const q3 = computeManagementSummary(
      fixtureInput({ unit: "quarter", year: 2026, quarter: 3 }),
    ).receivables;
    const r = buildReceivablesLayout(q3);
    const buf = await buildStackedWorkbook({
      template: await readFile(TEMPLATE_PATH),
      sheets: [
        { name: "2026", layout: t.layout, maxAux: t.maxAux },
        { name: "2026-Q3", layout: r.layout, maxAux: r.maxAux },
      ],
      lists: [receivablesListSheet(q3)],
      now: NOW,
    });
    await expect(
      JSON.stringify(await dumpWorkbook(buf), null, 1),
    ).toMatchFileSnapshot("__snapshots__/stacked-targets-receivables.json");
  });
});
