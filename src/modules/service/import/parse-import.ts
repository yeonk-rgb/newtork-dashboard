// 출장보고서 엑셀(한 행 = 보고서 1건) 해석 (순수 함수) — 친구 저장소 import_service_xlsx.py 규칙 그대로
// - 시트 "출장보고서", 머리글 1행에 COLUMNS 가 모두 있어야 함, 완전히 빈 행은 건너뜀
// - 지역은 엑셀의 시·도 + 시·군을 주소 판정 규칙(parseAddress)으로 공식 이름에 맞춘다. 시·군이 비면 시·군·구 미확인
// - 엑셀에 없는 값(작성 상태, 주소, 단가, 부품 수량 등)은 비워 둔다
// - 메모에 "엑셀 가져오기: <파일명> 번호 <n>" — 다시 실행해도 같은 행을 두 번 저장하지 않게
// - 화면 입력과 같은 검증(reportInputSchema)
import { parseAddress } from "../regions/regions";
import { reportInputSchema, type ReportValues } from "../reports/schemas";

export const SHEET = "출장보고서";
export const PRODUCT_COL = "제품(모델명 | 사양 | 일련번호 | 수량)";
export const COLUMNS = [
  "번호",
  "출장 시작일",
  "출장 종료일",
  "요청처",
  "시·도",
  "시·군",
  "비용청구",
  "작업 구분",
  "작성자",
  "동행자",
  PRODUCT_COL,
  "교체 부품",
  "요청처 구분",
  "추가 출장",
  "출장 목적",
  "고장 내용",
  "작업 내용",
  "작업 결과",
] as const;
const BILLING: Record<string, "PAID" | "FREE"> = { 유상: "PAID", 무상: "FREE" };

/** 셀 값 — 날짜 셀은 Date, 글자·숫자는 그대로, 빈 칸은 null */
export type ImportCell = string | number | boolean | Date | null;

const text = (v: ImportCell) => (v === null ? "" : String(v).trim());
const lines = (v: ImportCell) =>
  text(v)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

function date(v: ImportCell): string {
  if (v === null || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  throw new Error(`날짜가 아닙니다: '${v}'`);
}

function products(v: ImportCell) {
  return lines(v).map((line) => {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length !== 4) {
      throw new Error(
        `제품 형식은 '모델명 | 사양 | 일련번호 | 수량'이어야 합니다: '${line}'`,
      );
    }
    const [modelName, spec, serialNo, qty] = cells;
    if (qty && !/^\d+$/.test(qty))
      throw new Error(`제품 수량이 숫자가 아닙니다: '${qty}'`);
    return { modelName, spec, serialNo, quantity: qty ? Number(qty) : null };
  });
}

export type ImportRow = {
  excelRow: number;
  no: string;
  marker: string;
  values: ReportValues;
  serials: string[];
};

export type ParsedImport =
  | { ok: false; error: string }
  | { ok: true; rows: ImportRow[]; errors: string[] };

/** 시트 표(1행 머리글) → 저장할 행·오류. 중복 확인은 DB 가 필요해 save-import 에서 */
export function parseImportSheet(
  table: ImportCell[][],
  fileName: string,
): ParsedImport {
  const header = (table[0] ?? []).map(text);
  const missing = COLUMNS.filter((c) => !header.includes(c));
  if (missing.length)
    return { ok: false, error: `없는 열: ${missing.join(", ")}` };
  const col = Object.fromEntries(
    COLUMNS.map((c) => [c, header.indexOf(c)]),
  ) as Record<(typeof COLUMNS)[number], number>;
  const name = fileName.normalize("NFC");
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((raw, i) => {
    const excelRow = i + 2;
    if (raw.every((v) => v === null || v === undefined)) return;
    const get = (c: (typeof COLUMNS)[number]) => raw[col[c]] ?? null;
    const no = text(get("번호"));
    const marker = `엑셀 가져오기: ${name} 번호 ${no}`;
    try {
      const sidoIn = text(get("시·도"));
      const sigunguIn = text(get("시·군"));
      const r = sidoIn
        ? parseAddress(`${sidoIn} ${sigunguIn}`.trim())
        : { region: null, sigungu: null };
      if (sidoIn && r.region === null)
        throw new Error(`공식 목록에 없는 시·도: '${sidoIn}'`);
      if (sigunguIn && r.sigungu === null)
        throw new Error(`${r.region}에 없는 시·군: '${sigunguIn}'`);
      const billingIn = text(get("비용청구"));
      if (billingIn && !(billingIn in BILLING))
        throw new Error(`비용청구는 유상·무상만 가능합니다: '${billingIn}'`);
      const ps = products(get(PRODUCT_COL));
      const parsed = reportInputSchema.safeParse({
        title: text(get("출장 목적")),
        tripStart: date(get("출장 시작일")),
        tripEnd: date(get("출장 종료일")),
        requestOrg: text(get("요청처")),
        requestOrgType: text(get("요청처 구분")),
        extraTrip: text(get("추가 출장")),
        region: r.region ?? "",
        sigungu: r.sigungu ?? "",
        billing: BILLING[billingIn] ?? "",
        workType: text(get("작업 구분")),
        authorName: text(get("작성자")),
        companions: lines(get("동행자")),
        products: ps,
        parts: lines(get("교체 부품")).map((n) => ({ name: n })),
        faultDescription: text(get("고장 내용")),
        workDescription: text(get("작업 내용")),
        workResult: text(get("작업 결과")),
        note: marker,
      });
      if (!parsed.success) {
        throw new Error(
          parsed.error.issues
            .map((x) => `${String(x.path[0] ?? "")} ${x.message}`.trim())
            .join(" / "),
        );
      }
      rows.push({
        excelRow,
        no,
        marker,
        values: parsed.data,
        serials: ps.map((p) => p.serialNo).filter(Boolean),
      });
    } catch (e) {
      errors.push(`${excelRow}행(번호 ${no}): ${(e as Error).message}`);
    }
  });
  return { ok: true, rows, errors };
}
