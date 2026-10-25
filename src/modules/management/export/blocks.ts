// 경영지원 엑셀 다운로드 공용 — 원본 양식처럼 표를 세로로 쌓는 시트 배치 (순수 함수, exceljs 모름)
// 원본 규칙: 블록마다 제목(C:F 병합) → 머리글 → 그룹(행들 + F열 총액 병합·=SUM + H열 "← 메모") → 빈 행
// - 그룹 행 수 = max(데이터 수, 1). 빈 그룹도 빈 행 1개 + 총액 0 + 메모 (원본 양식의 빈 칸 모양)
// - 총액: F열 그룹 병합 + =SUM(D첫행:D끝행) + 계산값 (엑셀을 열자마자 숫자가 보인다)
// - 메모: 그룹 가운데 행 (원본 H17·H31 처럼)
import {
  COL,
  type CellSpec,
  type RowKind,
  type RowSpec,
  type SheetLayout,
  type TotalPart,
} from "./draw";

export type GroupItem = {
  /** A열 코드 (style.code 가 있을 때만 그린다) */
  code?: string | null;
  name: string | null;
  amount: number | null;
  note: string | null;
  /** 적요만 빨간 글씨 (예: "임시저장 — 합계 제외") */
  noteWarn?: boolean;
};

export type GroupStyle<R extends string> = {
  name: R;
  amount: R;
  note: R;
  total: R;
  memo: R;
  /** A열 코드 칸 역할 (외상매출금만) */
  code?: R;
  /** 원본 총액 칸 테두리를 그대로 쓴다 (업체 F67:F79 는 칸마다 네 면 테두리 — 위·가운데·아래 규칙을 적용하지 않음) */
  keepTotalBorder?: boolean;
};

export type Memo = { text: string; warn?: boolean };

const partOf = (i: number, n: number): TotalPart =>
  n === 1 ? "single" : i === 0 ? "top" : i === n - 1 ? "bottom" : "middle";

export class SheetBuilder<R extends string, A = string> {
  rows: RowSpec<R, A>[] = [];
  merges: string[] = [];

  get next() {
    return this.rows.length + 1;
  }

  push(kind: RowKind, cells: CellSpec<R>[], after?: A): number {
    const row = this.next;
    this.rows.push({
      row,
      kind,
      cells,
      ...(after !== undefined ? { after } : {}),
    });
    return row;
  }

  /** 이미 있는 행에 칸 추가 — 행이 아직 없으면 빈 데이터 행을 늘린다 (H·I열 보조 줄이 블록보다 길 때) */
  cell(row: number, spec: CellSpec<R>) {
    while (this.rows.length < row) this.push("data", []);
    this.rows[row - 1].cells.push(spec);
  }

  /** 블록 제목 (C:F 병합) */
  title(text: string, role: R): number {
    const row = this.push("title", [{ col: COL.C, role, value: text }]);
    this.merges.push(`C${row}:F${row}`);
    return row;
  }

  header(cells: CellSpec<R>[]): number {
    return this.push("header", cells);
  }

  /** 그룹 하나: 행들 + F열 총액 병합·SUM + H열 메모. 첫 행·끝 행·메모 행·합계를 돌려준다 */
  group(
    items: GroupItem[],
    style: GroupStyle<R>,
    memo: Memo,
    opts: { totalWarn?: boolean } = {},
  ): { first: number; last: number; memoRow: number; sum: number } {
    const n = Math.max(items.length, 1);
    const first = this.next;
    const last = first + n - 1;
    const sum = items.reduce((s, r) => s + (r.amount ?? 0), 0);
    const memoRow = first + Math.floor((n - 1) / 2);
    for (let i = 0; i < n; i++) {
      const r = items[i];
      const row = first + i;
      const cells: CellSpec<R>[] = [];
      if (style.code) {
        cells.push({
          col: COL.A,
          role: style.code,
          value: r?.code ?? null,
          asText: true,
        });
      }
      cells.push(
        { col: COL.C, role: style.name, value: r?.name ?? null },
        { col: COL.D, role: style.amount, value: r?.amount ?? null },
        {
          col: COL.E,
          role: style.note,
          value: r?.note ?? null,
          ...(r?.noteWarn ? { warn: true } : {}),
        },
        {
          col: COL.F,
          role: style.total,
          ...(style.keepTotalBorder ? {} : { totalPart: partOf(i, n) }),
          ...(i === 0
            ? { formula: { expr: `SUM(D${first}:D${last})`, result: sum } }
            : {}),
          ...(opts.totalWarn ? { warn: true } : {}),
        },
      );
      if (row === memoRow) {
        cells.push({
          col: COL.H,
          role: style.memo,
          value: `← ${memo.text}`,
          ...(memo.warn ? { warn: true } : {}),
        });
      }
      this.push("data", cells);
    }
    if (n > 1) this.merges.push(`F${first}:F${last}`);
    return { first, last, memoRow, sum };
  }

  separator(after: A) {
    this.push("separator", [], after);
  }

  layout(): SheetLayout<R, A> {
    return { rows: this.rows, merges: this.merges };
  }
}
