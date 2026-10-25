// 월간 입력 다운로드 결과물 고정 — 셀 값·수식·계산값·서식·병합·열·행·인쇄·문서 속성·테마가 그대로인지
// 2026-10-25 엑셀 PR ②(목표 대비 실적·미수금)에서 공용 엔진을 넓히기 직전 결과물로 만든 스냅샷.
// 바뀌면 의도한 변경인지 확인 후 `npx vitest run -u <이 파일>` 로 갱신한다 (공용 엔진만 손댔다면 갱신하지 말 것)
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { dumpWorkbook } from "../../export/testing/dump-workbook";
import { parseExportPeriod } from "../../export/period";
import { TEMPLATE_PATH } from "../../ledger/import/test-helpers";
import { buildEntryWorkbook } from "./build-entry-workbook";
import { planEntrySheets } from "./plan";
import { SAMPLE_CATEGORIES, SAMPLE_MONTHS } from "./test-data";

const NOW = new Date("2026-10-25T03:00:00Z");

describe("월간 입력 다운로드 결과물 스냅샷", () => {
  it("2026-Q3 (합계 시트 + 7·8월 확정 + 9월 임시저장)", async () => {
    const buf = await buildEntryWorkbook({
      template: await readFile(TEMPLATE_PATH),
      sheets: planEntrySheets({
        period: parseExportPeriod("2026-Q3")!,
        months: [7, 8, 9].map((month) => ({ year: 2026, month })),
        data: SAMPLE_MONTHS,
        categories: SAMPLE_CATEGORIES,
      }),
      now: NOW,
    });
    await expect(
      JSON.stringify(await dumpWorkbook(buf), null, 1),
    ).toMatchFileSnapshot("__snapshots__/entry-2026-Q3.json");
  });
});
