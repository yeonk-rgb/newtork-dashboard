import { describe, expect, it } from "vitest";

import { cellKey, type StyledSheet } from "@/shared/upload/read-styled-sheet";

import {
  defaultSettledOn,
  formatNoteDate,
  isGreenFill,
  isRed,
  noteDateCandidate,
  parseLedgerSheet,
  readAmount,
  readPartnerCode,
  statusFromMemo,
  type ParsedLedgerSheet,
} from "./parse-ledger-sheet";
import { editedSheet, OPTS, parseFixture } from "./test-helpers";

const block = (p: ParsedLedgerSheet, kind: string) =>
  p.blocks.find((b) => b.kind === kind)!;
const rowAt = (p: ParsedLedgerSheet, row: number) =>
  p.blocks.flatMap((b) => b.rows).find((r) => r.row === row);

describe("원본 빈 양식 (ledger-template.xlsx)", () => {
  it("블록 4개를 찾고, 가져올 행 없음 — 오류 아님", async () => {
    const p = await parseFixture("ledger-template.xlsx");
    expect(p.fatal).toEqual([]);
    expect(p.blocks.map((b) => [b.kind, b.firstRow, b.lastRow])).toEqual([
      ["AR", 3, 38],
      ["AP", 41, 50],
      ["ACCRUED_STAFF", 53, 63],
      ["ACCRUED_VENDOR", 66, 87],
    ]);
    expect(p.blocks.every((b) => b.rows.length === 0)).toBe(true);
  });

  it("A3 처럼 코드만 있는 행은 건너뛴 행으로 센다, E66 '자동이체' 글자만 있는 행은 조용히 건너뜀", async () => {
    const p = await parseFixture("ledger-template.xlsx");
    expect(block(p, "AR").skipped.codeOnly).toEqual([3]);
    expect(block(p, "ACCRUED_VENDOR").skipped.codeOnly).toEqual([]);
  });

  it("총액: 장기미수 F3:F4 는 원본 총액 없음, 나머지는 계산값 0 = 행 합계 0 → 일치", async () => {
    const p = await parseFixture("ledger-template.xlsx");
    expect(
      block(p, "AR").totals.map((t) => [
        t.range,
        t.state,
        t.formula,
        t.fileTotal,
      ]),
    ).toEqual([
      ["F3:F4", "noTotal", null, null],
      ["F5:F24", "match", "SUM(D5:D24)", 0n],
      ["F25:F37", "match", "SUM(D25:D37)", 0n],
    ]);
    expect(
      p.blocks
        .flatMap((b) => b.totals)
        .filter((t) => t.range !== "F3:F4")
        .map((t) => t.state),
    ).toEqual(["match", "match", "match", "match", "match"]);
    expect(block(p, "ACCRUED_VENDOR").totals.map((t) => t.range)).toEqual([
      "F67:F79",
    ]);
  });
});

describe("가짜 거래처 파일 (ledger-sample.xlsx)", () => {
  it("빈 행을 건너뛰고 행 수·합계를 읽는다", async () => {
    const p = await parseFixture("ledger-sample.xlsx");
    expect(p.fatal).toEqual([]);
    expect(p.blocks.map((b) => [b.kind, b.rows.map((r) => r.row)])).toEqual([
      ["AR", [3, 4, 5, 6, 8, 25, 26, 28]],
      ["AP", [41, 42, 43]],
      ["ACCRUED_STAFF", [53, 54]],
      ["ACCRUED_VENDOR", [66, 67, 68]],
    ]);
    expect(
      p.blocks.flatMap((b) => b.rows).every((r) => r.errors.length === 0),
    ).toBe(true);
  });

  it("코드: 문자열은 앞자리 0 유지, 숫자 118 은 10자리로 0 채움, 없으면 null", async () => {
    const p = await parseFixture("ledger-sample.xlsx");
    expect(rowAt(p, 3)?.partnerCode).toBe("0000000087");
    expect(rowAt(p, 6)?.partnerCode).toBe("0000000118");
    expect(rowAt(p, 28)?.partnerCode).toBeNull();
  });

  it("그룹 상태: F열 병합 범위 + H열 메모, 빨간 글씨는 장기미수", async () => {
    const p = await parseFixture("ledger-sample.xlsx");
    const ar = block(p, "AR").rows;
    expect(ar.map((r) => [r.row, r.arStatus, r.arStatusSource])).toEqual([
      [3, "LONG_OVERDUE", "red"],
      [4, "LONG_OVERDUE", "red"],
      [5, "COLLECTED", "memo"],
      [6, "COLLECTED", "memo"],
      [8, "COLLECTED", "memo"],
      [25, "SCHEDULED", "memo"],
      [26, "SCHEDULED", "memo"],
      [28, "SCHEDULED", "memo"],
    ]);
    // 빨간 글씨 + 장기미수 그룹이면 경고 없음
    expect(rowAt(p, 3)?.warnings).toEqual([]);
  });

  it("수금완료 완료일: 적요 날짜(E8 10/15)는 후보로, 없으면 min(기준월 말일, 오늘)", async () => {
    const p = await parseFixture("ledger-sample.xlsx");
    expect(rowAt(p, 8)).toMatchObject({
      note: "10/15",
      settledOn: "2026-10-15",
      settledSource: "note",
    });
    expect(rowAt(p, 5)).toMatchObject({
      note: "전동밸브 수리",
      settledOn: "2026-10-25",
      settledSource: "monthEnd",
    });
    // 수금예정·장기미수는 완료일 없음
    expect(rowAt(p, 25)?.settledOn).toBeNull();
    expect(rowAt(p, 3)?.settledOn).toBeNull();
  });

  it("자동이체: 66행(적요 '자동이체' + 연두 배경), 다른 업체 행은 아님", async () => {
    const p = await parseFixture("ledger-sample.xlsx");
    expect(
      block(p, "ACCRUED_VENDOR").rows.map((r) => [
        r.row,
        r.autoTransfer,
        r.note,
      ]),
    ).toEqual([
      [66, true, "자동이체"],
      [67, false, "온라인 광고"],
      [68, false, "거래처 접대"],
    ]);
  });

  it("총액 비교: 그룹별 일치, 업체는 SUM(D67:D79) — 66행 자동이체 제외", async () => {
    const p = await parseFixture("ledger-sample.xlsx");
    const states = p.blocks.flatMap((b) =>
      b.totals.map((t) => [t.range, t.state, t.rowsSum]),
    );
    expect(states).toEqual([
      ["F3:F4", "noTotal", 16_900_000n],
      ["F5:F24", "match", 7_150_000n],
      ["F25:F37", "match", 15_290_000n],
      ["F41:F49", "match", 6_180_000n],
      ["F53:F62", "match", 470_000n],
      ["F67:F79", "match", 2_580_000n],
    ]);
  });
});

describe("경고 확인용 파일 (ledger-sample-issues.xlsx)", () => {
  it("H31 메모가 없으면 그 그룹은 미분류", async () => {
    const p = await parseFixture("ledger-sample-issues.xlsx");
    expect(
      [25, 26, 28].map((r) => [
        rowAt(p, r)?.arStatus,
        rowAt(p, r)?.arStatusSource,
      ]),
    ).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it("총액 불일치: 원본 6,000,000 · 행 합계 6,180,000", async () => {
    const p = await parseFixture("ledger-sample-issues.xlsx");
    expect(block(p, "AP").totals[0]).toMatchObject({
      state: "mismatch",
      fileTotal: 6_000_000n,
      rowsSum: 6_180_000n,
    });
  });

  it("0원 행은 제외, 코드만 있는 행은 건너뜀", async () => {
    const p = await parseFixture("ledger-sample-issues.xlsx");
    expect(block(p, "AR").skipped).toEqual({ codeOnly: [30], zero: [29] });
    expect(rowAt(p, 29)).toBeUndefined();
  });

  it("수금완료가 아닌 그룹의 적요 날짜는 글자로만 저장 (완료일 후보 아님)", async () => {
    const p = await parseFixture("ledger-sample-issues.xlsx");
    expect(rowAt(p, 26)).toMatchObject({ note: "10/20", settledOn: null });
  });
});

describe("적요 날짜 → 완료일 후보 (기준월 안만)", () => {
  it("기준월 밖(9월로 가져오는데 적요 10/15): 쓰지 않고 기본값, 이유 표시, 적요 원문 보존", async () => {
    const p = await parseFixture("ledger-sample.xlsx", {
      ...OPTS,
      month: 9,
    });
    expect(rowAt(p, 8)).toMatchObject({
      note: "10/15",
      settledOn: "2026-09-30",
      settledSource: "monthEnd",
      noteDateIgnored: "적요 날짜(10/15)가 기준월 밖이라 사용하지 않음",
    });
  });

  it("기준월 안이지만 오늘 이후(10/26): 쓰지 않고 오늘, 이유 표시", async () => {
    const sheet = await editedSheet("ledger-sample.xlsx", (ws) => {
      ws.getCell("E8").value = new Date(Date.UTC(2026, 9, 26));
    });
    const r = parseLedgerSheet(sheet, OPTS).blocks[0].rows.find(
      (x) => x.row === 8,
    );
    expect(r).toMatchObject({
      note: "10/26",
      settledOn: "2026-10-25",
      settledSource: "monthEnd",
      noteDateIgnored: "적요 날짜(10/26)가 오늘 이후라 사용하지 않음",
    });
  });

  it("기준월 안·오늘 이전이면 후보, 적요가 날짜가 아니면 이유 없음", async () => {
    const p = await parseFixture("ledger-sample.xlsx");
    expect(rowAt(p, 8)).toMatchObject({
      settledOn: "2026-10-15",
      settledSource: "note",
      noteDateIgnored: null,
    });
    expect(rowAt(p, 5)?.noteDateIgnored).toBeNull();
  });
});

describe("원본 총액 계산값 0 과 '계산값 없음' 구분 (2026-10-25 버그 수정)", () => {
  it("계산값 0 + 행 합계 0 → 일치", async () => {
    const p = await parseFixture("ledger-template.xlsx");
    expect(block(p, "AP").totals[0]).toMatchObject({
      state: "match",
      fileTotal: 0n,
      rowsSum: 0n,
    });
  });

  it("계산값 0 + 행에 금액 있음 → 불일치 (계산값 없음으로 숨기지 않음)", async () => {
    // 원본 빈 양식(계산값 0)에 금액만 적고 엑셀이 다시 계산하지 않은 경우
    const sheet = await editedSheet("ledger-template.xlsx", (ws) => {
      ws.getCell("C41").value = "가가금속(가상)";
      ws.getCell("D41").value = 1_000_000;
    });
    expect(parseLedgerSheet(sheet, OPTS).blocks[1].totals[0]).toMatchObject({
      state: "mismatch",
      fileTotal: 0n,
      rowsSum: 1_000_000n,
    });
  });

  it("수식만 있고 계산값 없음 → 계산값 없음", async () => {
    const sheet = await editedSheet("ledger-sample.xlsx", (ws) => {
      ws.getCell("F41").value = { formula: "SUM(D41:D49)" } as never;
    });
    expect(parseLedgerSheet(sheet, OPTS).blocks[1].totals[0]).toMatchObject({
      state: "noResult",
      fileTotal: null,
      rowsSum: 6_180_000n,
    });
  });
});

describe("메모리에서 고친 파일", () => {
  it("다른 그룹 행이 빨간 글씨면 장기미수 + 원래 그룹 경고", async () => {
    const sheet = await editedSheet("ledger-sample.xlsx", (ws) => {
      ws.getCell("C5").font = { color: { argb: "FFFF0000" } };
    });
    const r = parseLedgerSheet(sheet, OPTS).blocks[0].rows.find(
      (x) => x.row === 5,
    );
    expect(r).toMatchObject({
      arStatus: "LONG_OVERDUE",
      arStatusSource: "red",
    });
    expect(r?.warnings[0]).toContain("원래 그룹: 당월수금완료");
    expect(r?.settledOn).toBeNull();
  });

  it("업체 블록 D77:E79 빨간 글씨는 무시 — 경고 없는 일반 행", async () => {
    const sheet = await editedSheet("ledger-sample.xlsx", (ws) => {
      ws.getCell("C77").value = "가가인쇄(가상)";
      ws.getCell("D77").value = 55_000;
    });
    const r = parseLedgerSheet(sheet, OPTS).blocks[3].rows.find(
      (x) => x.row === 77,
    );
    expect(r).toMatchObject({ autoTransfer: false, warnings: [], errors: [] });
  });

  it("잔액 오류: 음수는 이유를 보여 주고 막음, 소수·글자·거래처명 없음·잔액 없음", async () => {
    const sheet = await editedSheet("ledger-sample.xlsx", (ws) => {
      ws.getCell("D41").value = -1000;
      ws.getCell("D42").value = 1000.5;
      ws.getCell("D43").value = "미정";
      ws.getCell("D44").value = 3000;
      ws.getCell("C45").value = "잔액없음(가상)";
    });
    const ap = parseLedgerSheet(sheet, OPTS).blocks[1].rows;
    const err = (row: number) => ap.find((r) => r.row === row)?.errors[0];
    expect(err(41)).toContain("음수 잔액");
    expect(err(41)).toContain("선수금·과입금");
    expect(err(42)).toContain("소수점");
    expect(err(43)).toContain("숫자가 아닙니다");
    expect(err(44)).toBe("거래처명이 없습니다.");
    expect(err(45)).toBe("잔액이 없습니다.");
  });

  it("글자로 적힌 금액은 콤마·'원'을 빼고 읽는다", async () => {
    const sheet = await editedSheet("ledger-sample.xlsx", (ws) => {
      ws.getCell("D53").value = " 350,000원 ";
    });
    const r = parseLedgerSheet(sheet, OPTS).blocks[2].rows[0];
    expect(r).toMatchObject({ amount: 350_000n, errors: [] });
  });

  it("거래처코드가 10자리가 아니면 오류", async () => {
    const sheet = await editedSheet("ledger-sample.xlsx", (ws) => {
      ws.getCell("A5").value = "87";
      ws.getCell("A6").value = 12345678901;
    });
    const ar = parseLedgerSheet(sheet, OPTS).blocks[0].rows;
    expect(ar.find((r) => r.row === 5)?.errors[0]).toContain('"87"');
    expect(ar.find((r) => r.row === 6)?.errors[0]).toContain("숫자 10자리");
  });

  it("머리글이 바뀌면 양식 오류(fatal)", async () => {
    const sheet = await editedSheet("ledger-sample.xlsx", (ws) => {
      ws.getCell("D40").value = "금액";
    });
    const p = parseLedgerSheet(sheet, OPTS);
    expect(p.fatal).toEqual([
      '외상매입금: 40행 머리글이 양식과 다릅니다 (D열 "잔액" 필요).',
    ]);
    expect(p.blocks.map((b) => b.kind)).not.toContain("AP");
  });

  it("블록 제목이 없으면 fatal", async () => {
    const sheet = await editedSheet("ledger-template.xlsx", (ws) => {
      ws.getCell("C51").value = "미지급비용";
    });
    expect(parseLedgerSheet(sheet, OPTS).fatal).toEqual([
      '"미지급비용-직원" 블록 제목(C열)을 찾지 못했습니다.',
    ]);
  });
});

describe("행 번호가 아니라 제목 글자로 블록을 찾는다", () => {
  // 행 번호가 다른 작은 시트를 직접 만든다
  const sheet = (): StyledSheet => {
    const cells = new Map<string, { value: string | number }>();
    const put = (r: number, c: number, value: string | number) =>
      cells.set(cellKey(r, c), { value });
    const header = (r: number, withCode: boolean) => {
      if (withCode) put(r, 1, "코드");
      put(r, 3, "거래처명");
      put(r, 4, "잔액");
      put(r, 5, "적요");
      put(r, 6, "총액");
    };
    put(10, 3, "외상매출금");
    header(11, true);
    put(12, 3, "가가(가상)");
    put(12, 4, 1000);
    put(12, 8, "← 당월 수금예정인 업체");
    put(20, 3, " 외상 매입금 ");
    header(21, false);
    put(22, 3, "나나(가상)");
    put(22, 4, 2000);
    put(30, 3, "미지급비용-직원");
    header(31, false);
    put(40, 3, "미지급비용-업체");
    header(41, false);
    return {
      name: "Sheet1",
      rowCount: 45,
      columnCount: 8,
      cells,
      merges: [{ top: 12, left: 6, bottom: 15, right: 6 }],
      hiddenColumns: [],
    };
  };

  it("제목 행이 달라도·공백이 섞여도 블록을 찾는다", () => {
    const p = parseLedgerSheet(sheet(), OPTS);
    expect(p.fatal).toEqual([]);
    expect(p.blocks.map((b) => [b.kind, b.firstRow, b.lastRow])).toEqual([
      ["AR", 12, 19],
      ["AP", 22, 29],
      ["ACCRUED_STAFF", 32, 39],
      ["ACCRUED_VENDOR", 42, 45],
    ]);
    expect(p.blocks[0].rows[0].arStatus).toBe("SCHEDULED");
    // 원본 총액 칸이 없는 F 병합
    expect(p.blocks[0].totals[0].state).toBe("noTotal");
  });
});

describe("판별 함수", () => {
  it("statusFromMemo: 공백·화살표 무시", () => {
    expect(statusFromMemo("← 장기 미수금 업체")).toBe("LONG_OVERDUE");
    expect(statusFromMemo("←당월 수금된 업체")).toBe("COLLECTED");
    expect(statusFromMemo("당월수금예정인업체")).toBe("SCHEDULED");
    expect(statusFromMemo("← 당월 매입 지출")).toBeNull();
  });

  it("isRed·isGreenFill: 원본 연두는 테마 9번, 노랑은 초록 아님", () => {
    expect(isRed({ argb: "FFFF0000" })).toBe(true);
    expect(isRed({ argb: "FFC00000" })).toBe(false);
    expect(isGreenFill({ theme: 9, tint: 0.7999 })).toBe(true);
    expect(isGreenFill({ theme: 2 })).toBe(false);
    expect(isGreenFill({ argb: "FFC6EFCE" })).toBe(true);
    expect(isGreenFill({ argb: "FFE2EFDA" })).toBe(true);
    expect(isGreenFill({ argb: "FFFFFF00" })).toBe(false);
    expect(isGreenFill(undefined)).toBe(false);
  });

  it("formatNoteDate: 엑셀 표시 형식대로", () => {
    const d = new Date(Date.UTC(2026, 9, 5));
    expect(formatNoteDate(d, 'm"/"d;@')).toBe("10/5");
    expect(formatNoteDate(d, 'mm"월" dd"일"')).toBe("10월 05일");
    expect(formatNoteDate(d, undefined)).toBe("10/5");
  });

  it("noteDateCandidate: 연도는 기준년도, 기준월 밖·오늘 이후는 쓰지 않음", () => {
    const at = (m: number, d: number) => new Date(Date.UTC(1999, m - 1, d));
    expect(noteDateCandidate(at(10, 15), OPTS)).toEqual({
      ok: true,
      value: "2026-10-15",
    });
    expect(noteDateCandidate(at(10, 26), OPTS)).toEqual({
      ok: false,
      reason: "future",
    });
    expect(noteDateCandidate(at(9, 30), OPTS)).toEqual({
      ok: false,
      reason: "outsideMonth",
    });
    expect(
      noteDateCandidate(at(3, 1), {
        year: 2025,
        month: 3,
        today: "2026-10-25",
      }),
    ).toEqual({ ok: true, value: "2025-03-01" });
  });

  it("defaultSettledOn: 지난달은 말일, 이번 달은 오늘", () => {
    expect(
      defaultSettledOn({ year: 2026, month: 9, today: "2026-10-25" }),
    ).toBe("2026-09-30");
    expect(defaultSettledOn(OPTS)).toBe("2026-10-25");
    expect(
      defaultSettledOn({ year: 2024, month: 2, today: "2026-10-25" }),
    ).toBe("2024-02-29");
  });

  it("readAmount·readPartnerCode", () => {
    expect(readAmount({ value: 0 })).toEqual({ kind: "ok", amount: 0n });
    expect(
      readAmount({ value: null, formula: "SUM(A1)", hasResult: false }).kind,
    ).toBe("error");
    expect(readAmount({ value: 10, formula: "5*2", hasResult: true })).toEqual({
      kind: "ok",
      amount: 10n,
    });
    expect(readAmount({ value: 1e16 }).kind).toBe("error");
    expect(readPartnerCode({ value: 87 })).toEqual({
      code: "0000000087",
      error: null,
    });
    expect(readPartnerCode({ value: "  " })).toEqual({
      code: null,
      error: null,
    });
  });
});
