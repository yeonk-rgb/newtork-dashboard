// 경영지원 관리 다운로드 결과물 고정 — 셀 값·수식·계산값·서식·병합·열·행·인쇄·문서 속성·테마가 그대로인지
// 2026-10-25 공용 엔진(modules/management/export)으로 옮기기 직전 결과물로 만든 스냅샷. 바뀌면 의도한 변경인지 확인 후
// `npx vitest run -u <이 파일>` 로 갱신한다 (리팩터링만 했다면 갱신하지 말 것)
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { dumpWorkbook } from "../../export/testing/dump-workbook";
import { TEMPLATE_PATH } from "../import/test-helpers";
import { buildLedgerWorkbook, type ExportSheet } from "./build-ledger-workbook";
import { row, SAMPLE_ROWS } from "./test-rows";

const NOW = new Date("2026-10-25T03:00:00Z");

async function dump(sheets: ExportSheet[]) {
  const template = await readFile(TEMPLATE_PATH);
  const buf = await buildLedgerWorkbook({ template, sheets, now: NOW });
  return JSON.stringify(await dumpWorkbook(buf), null, 1);
}

describe("경영지원 관리 다운로드 결과물 스냅샷", () => {
  it("당월 (샘플 16행)", async () => {
    await expect(
      await dump([
        { sheetName: "2026-10", month: "2026-10", rows: SAMPLE_ROWS },
      ]),
    ).toMatchFileSnapshot("__snapshots__/ledger-2026-10.json");
  });

  it("1행 그룹·빈 블록만 있는 달", async () => {
    const one = SAMPLE_ROWS.filter((r) => r.arStatus === "COLLECTED").slice(
      0,
      1,
    );
    await expect(
      await dump([
        {
          sheetName: "2026-09",
          month: "2026-09",
          rows: [
            ...one,
            row({ kind: "AP", partnerName: "가상매입(가상)", amount: "1" }),
          ],
        },
      ]),
    ).toMatchFileSnapshot("__snapshots__/ledger-2026-09-small.json");
  });
});
