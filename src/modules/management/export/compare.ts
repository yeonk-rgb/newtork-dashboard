// 원본 양식 ↔ 새 다운로드 파일 셀 단위 비교 (테스트·비교 스크립트 공용, 서버 전용 아님)
// 결과 행마다 같음 / 의도한 차이(이유) / 의도하지 않은 차이 — 테스트는 "의도하지 않은 차이 0건"을 확인한다
import type ExcelJS from "exceljs";

import { SEPARATOR_ROWS, WORKBOOK_AUTHOR } from "./template";

export type CompareResult = "같음" | "의도한 차이" | "의도하지 않은 차이";

export type CompareRow = {
  /** 무엇을 비교했는지 ("항목 이름(name) — 글꼴") */
  item: string;
  original: string;
  actual: string;
  result: CompareResult;
  reason?: string;
};

/** 역할 하나: 원본 셀 ↔ 새 파일 셀, 미리 알고 있는 차이(속성 → 이유) */
export type RolePair = {
  label: string;
  source: string;
  target: { sheet: string; address: string };
  intended?: Partial<Record<StyleProp, string>>;
};

const STYLE_PROPS = ["font", "fill", "numFmt", "alignment", "border"] as const;
export type StyleProp = (typeof STYLE_PROPS)[number];

const PROP_LABEL: Record<StyleProp, string> = {
  font: "글꼴",
  fill: "채우기",
  numFmt: "표시 형식",
  alignment: "정렬",
  border: "테두리",
};

/** undefined 칸을 빼고 키 순서를 맞춘 문자열 (비교·표시용) */
export function stable(v: unknown): string {
  if (v === undefined || v === null) return "(없음)";
  const norm = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === "object") {
      return Object.fromEntries(
        Object.entries(x as Record<string, unknown>)
          .filter(([, val]) => val !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, val]) => [k, norm(val)]),
      );
    }
    return x;
  };
  const s = JSON.stringify(norm(v));
  return s === "{}" ? "(없음)" : s;
}

function row(
  item: string,
  original: unknown,
  actual: unknown,
  intended?: string,
): CompareRow {
  const o = typeof original === "string" ? original : stable(original);
  const a = typeof actual === "string" ? actual : stable(actual);
  if (o === a) return { item, original: o, actual: a, result: "같음" };
  return intended
    ? { item, original: o, actual: a, result: "의도한 차이", reason: intended }
    : { item, original: o, actual: a, result: "의도하지 않은 차이" };
}

/** 역할별 서식 비교 */
export function compareRoles(
  source: ExcelJS.Worksheet,
  out: ExcelJS.Workbook,
  pairs: RolePair[],
): CompareRow[] {
  return pairs.flatMap((p) => {
    const ws = out.getWorksheet(p.target.sheet);
    if (!ws) {
      return [row(`${p.label} — 시트`, p.target.sheet, "(시트 없음)")];
    }
    const o = source.getCell(p.source).style;
    const a = ws.getCell(p.target.address).style;
    return STYLE_PROPS.map((prop) =>
      row(
        `${p.label} — ${PROP_LABEL[prop]} (원본 ${p.source} ↔ ${p.target.sheet}!${p.target.address})`,
        o[prop],
        a[prop],
        p.intended?.[prop],
      ),
    );
  });
}

export type SheetIntended = {
  /** 인쇄 설정(너비 맞춤) 차이 이유 */
  print?: string;
  /** 용지 방향 차이 이유 */
  orientation?: string;
  /** 고정 배율 차이 이유 (블록 단위 쪽 나눔 시트) */
  scale?: string;
};

const PRINT_KEYS = [
  "paperSize",
  "orientation",
  "fitToPage",
  "fitToWidth",
  "fitToHeight",
  "scale",
  "margins",
] as const;

/** 시트 공통: 열 너비·숨김(A~H), 데이터 행 높이, 블록 사이 빈 행 높이, 인쇄, 보기 */
export function compareSheetBasics(
  source: ExcelJS.Worksheet,
  ws: ExcelJS.Worksheet,
  opts: {
    dataRow: number;
    /** 새 파일의 블록 사이 빈 행 (원본 38·50·63 순서) */
    separatorRows: number[];
    intended?: SheetIntended;
  },
): CompareRow[] {
  const rows: CompareRow[] = [];
  for (let c = 1; c <= 8; c++) {
    const letter = String.fromCharCode(64 + c);
    rows.push(
      row(
        `${ws.name} — ${letter}열 너비·숨김`,
        {
          width: source.getColumn(c).width,
          hidden: !!source.getColumn(c).hidden,
        },
        { width: ws.getColumn(c).width, hidden: !!ws.getColumn(c).hidden },
      ),
    );
  }
  rows.push(
    row(
      `${ws.name} — 데이터 행 높이 (원본 3행 ↔ ${opts.dataRow}행)`,
      String(source.getRow(3).height),
      String(ws.getRow(opts.dataRow).height),
    ),
  );
  opts.separatorRows.forEach((r, i) => {
    const src = SEPARATOR_ROWS[Math.min(i, SEPARATOR_ROWS.length - 1)];
    rows.push(
      row(
        `${ws.name} — 블록 사이 빈 행 높이 (원본 ${src}행 ↔ ${r}행)`,
        String(source.getRow(src).height),
        String(ws.getRow(r).height),
      ),
    );
  });
  for (const key of PRINT_KEYS) {
    const reason = key.startsWith("fitTo")
      ? opts.intended?.print
      : key === "orientation"
        ? opts.intended?.orientation
        : key === "scale"
          ? opts.intended?.scale
          : undefined;
    rows.push(
      row(
        `${ws.name} — 인쇄 ${key}`,
        source.pageSetup[key],
        ws.pageSetup[key],
        reason,
      ),
    );
  }
  const view = (v: Partial<ExcelJS.WorksheetView> | undefined) => ({
    zoomScale: v?.zoomScale ?? 100,
    showGridLines: v?.showGridLines ?? true,
    state: v?.state ?? "normal",
  });
  rows.push(
    row(
      `${ws.name} — 보기 (확대·눈금선·틀 고정)`,
      view(source.views[0]),
      view(ws.views[0]),
    ),
  );
  rows.push(
    row(
      `${ws.name} — 자동 필터`,
      source.autoFilter ?? "(없음)",
      ws.autoFilter ?? "(없음)",
    ),
  );
  return rows;
}

/** 통합 문서: 테마 파일, 문서 속성(개인 이름 없음) */
export function comparePackage(
  original: { theme: string | null; core: string | null },
  actual: { theme: string | null; core: string | null; app: string | null },
): CompareRow[] {
  const tag = (xml: string | null, name: string) =>
    new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml ?? "")?.[1] ?? "(없음)";
  const people = [
    tag(original.core, "dc:creator"),
    tag(original.core, "cp:lastModifiedBy"),
  ].filter((p) => p !== "(없음)" && p !== "");
  const leaked = people.filter(
    (p) => (actual.core ?? "").includes(p) || (actual.app ?? "").includes(p),
  );
  const color = (xml: string | null, name: string) =>
    new RegExp(`<a:${name}><a:srgbClr val="([0-9A-F]{6})"`).exec(
      xml ?? "",
    )?.[1] ?? "(없음)";
  return [
    row(
      "테마 파일 (theme1.xml 내용 전체)",
      `${(original.theme ?? "").length.toLocaleString("en-US")}자`,
      actual.theme === original.theme
        ? `${(original.theme ?? "").length.toLocaleString("en-US")}자`
        : `${(actual.theme ?? "").length.toLocaleString("en-US")}자 (내용 다름)`,
    ),
    row(
      "테마 색 lt2 (머리글 회색, 테마 2)",
      color(original.theme, "lt2"),
      color(actual.theme, "lt2"),
    ),
    row(
      "테마 색 accent6 (연두, 테마 9)",
      color(original.theme, "accent6"),
      color(actual.theme, "accent6"),
    ),
    row(
      "문서 속성 작성자",
      tag(original.core, "dc:creator"),
      tag(actual.core, "dc:creator"),
      tag(actual.core, "dc:creator") === WORKBOOK_AUTHOR
        ? "원본 작성자 이름을 남기지 않고 프로그램 이름으로"
        : undefined,
    ),
    row(
      "문서 속성 마지막 수정자",
      tag(original.core, "cp:lastModifiedBy"),
      tag(actual.core, "cp:lastModifiedBy"),
      tag(actual.core, "cp:lastModifiedBy") === WORKBOOK_AUTHOR
        ? "원본 수정자(개인 이름)를 남기지 않고 프로그램 이름으로"
        : undefined,
    ),
    row(
      "문서 속성에 원본 작성자·수정자 이름이 남아 있는지",
      "남으면 안 됨",
      leaked.length === 0 ? "남으면 안 됨" : `남음: ${leaked.join(", ")}`,
    ),
  ];
}

export function unintended(rows: CompareRow[]): CompareRow[] {
  return rows.filter((r) => r.result === "의도하지 않은 차이");
}

/** 마크다운 표 (비교 스크립트 출력) */
export function toMarkdown(rows: CompareRow[]): string {
  const esc = (s: string) => s.replace(/\|/g, "\\|").slice(0, 160);
  return [
    "| 항목 | 원본 | 새 파일 | 결과 | 이유 |",
    "|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${esc(r.item)} | ${esc(r.original)} | ${esc(r.actual)} | ${r.result} | ${esc(r.reason ?? "")} |`,
    ),
  ].join("\n");
}
