// 출장보고서 PDF 줄 목록 → 입력 폼 값 (순수 함수) — 친구 저장소 backend/service/pdf_import.py parse() 그대로
// - 양식의 항목 이름(라벨) 아래 줄들을 그 항목 값으로 본다. 빈 항목은 바로 다음 줄이 라벨
// - PDF에 없는 값(지역·주소, 부품 수량)은 만들지 않는다. 읽은 값도 사람이 확인한 뒤 저장한다
// - 확실하지 않은 값은 warnings 에 { field, message }
export type Line = { text: string; left: number; right: number };

export class PdfImportError extends Error {}

/** 라벨(공백 제거) → 칸. "p." 은 제품 목록 열 */
const LABELS: Record<string, string> = {
  요청처구분: "requestOrgType",
  "요청처(검색불가시)": "requestOrg",
  "현장담당자/연락처": "siteContact",
  출장시작일: "tripStart",
  출장종료일: "tripEnd",
  추가출장: "extraTrip",
  동행자: "companions",
  작성일: "writtenAt",
  작성자: "authorName",
  해피콜예정일: "happyCallDate",
  작업구분: "workType",
  출장목적: "title",
  고장내용: "faultDescription",
  작업내용: "workDescription",
  작업결과: "workResult",
  비용청구유무: "billing",
  부품사용내역: "parts",
  견적서구분: "quoteType",
  견적서: "quote",
  승인자: "approver",
  참조자: "cc",
  모델명: "p.modelName",
  사양: "p.spec",
  일련번호: "p.serialNo",
  수량: "p.quantity",
};
/** 값이 없는 구역 제목(사진 칸 포함) — 이 줄을 만나면 앞 항목 값은 끝 */
const SECTIONS = new Set([
  "MainFormmain",
  "출장정보",
  "작업개요",
  "제품목록",
  "수리내역",
  "명판사진",
  "작업전사진",
  "작업후사진",
  "부품교체전사진",
  "부품교체후사진",
  "관련자료(판넬도면등)",
  "비고",
]);
/** 이 중 6개 이상 있어야 출장보고서 양식 */
const REQUIRED = new Set([
  "출장시작일",
  "요청처(검색불가시)",
  "작성자",
  "작업구분",
  "출장목적",
  "모델명",
  "일련번호",
  "비용청구유무",
]);
const MIN_REQUIRED = 6;
const MULTILINE = ["faultDescription", "workDescription", "workResult"];
const BILLING: Record<string, "PAID" | "FREE"> = { 유상: "PAID", 무상: "FREE" };
const LIST_ITEM = /^\s*(\d+[.)]|[-•·*])\s/;

export type PdfWarning = { field: string; message: string };
export type ParsedProduct = {
  modelName: string;
  spec: string;
  serialNo: string;
  quantity: number | null;
};
export type ParsedReport = Partial<{
  title: string;
  status: string;
  requestOrgType: string;
  requestOrg: string;
  siteContact: string;
  extraTrip: string;
  authorName: string;
  workType: string;
  quoteType: string;
  quote: string;
  approver: string;
  cc: string;
  faultDescription: string;
  workDescription: string;
  workResult: string;
  tripStart: string | null;
  tripEnd: string | null;
  happyCallDate: string | null;
  /** 한국 시간 "YYYY-MM-DDTHH:mm" */
  writtenAt: string | null;
}> & {
  companions: string[];
  billing: "PAID" | "FREE" | null;
  products: ParsedProduct[];
  parts: { name: string; quantity: null }[];
  region: null;
  sigungu: null;
};

export type Extracted = {
  data: ParsedReport;
  warnings: PdfWarning[];
  truncatedParts: { index: number; name: string; suggestions: string[] }[];
};

const norm = (t: string) => t.replace(/\s+/g, "");
/** 파이썬 round() — 반올림 대상이 .5 면 짝수로 */
const pyRound = (x: number) => {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
};

function group(lines: Line[]) {
  const values = new Map<string, Line[]>();
  let current: string | null = null;
  for (const ln of lines.slice(1)) {
    const key = norm(ln.text);
    if (key in LABELS) {
      current = LABELS[key];
      if (!values.has(current)) values.set(current, []);
    } else if (SECTIONS.has(key)) {
      current = null;
    } else if (current) {
      values.get(current)!.push(ln);
    }
  }
  return values;
}

/** 여러 줄 글 — 줄 끝이 칸 오른쪽 끝에 닿은 줄은 화면 폭 때문에 넘어간 것으로 보고 이어 붙인다 */
function joinParagraph(lines: Line[], columnRight: number | null) {
  let out = "";
  let soft = false;
  lines.forEach((ln, i) => {
    if (i) {
      const prev = lines[i - 1];
      const wrapped =
        !!columnRight &&
        prev.right >= columnRight - 8 &&
        !LIST_ITEM.test(ln.text);
      out += wrapped ? "" : "\n";
      soft ||= wrapped;
    }
    out += ln.text;
  });
  return { text: out, soft };
}

function isoDate(text: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
    ? m[0]
    : null;
}

function writtenAt(text: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})\s*(?:\(.\))?\s*(\d{1,2}):(\d{2})$/.exec(
    text.trim(),
  );
  const d = m && isoDate(m[1]);
  if (!m || !d) return null;
  const [h, mi] = [Number(m[2]), Number(m[3])];
  if (h > 23 || mi > 59) return null;
  return `${d}T${String(h).padStart(2, "0")}:${m[3]}`;
}

/** 줄 목록 → 값. partNames: 잘린 부품명 추천에 쓸 기존 부품 이름 */
export function parseReportLines(
  lines: Line[],
  partNames: string[] = [],
): Extracted {
  if (!lines.length) {
    throw new PdfImportError(
      "PDF에서 글자를 찾지 못했습니다(스캔한 이미지 PDF일 수 있습니다). 자동 추출 없이 직접 입력해 주세요.",
    );
  }
  const found = new Set(
    lines.map((ln) => norm(ln.text)).filter((k) => REQUIRED.has(k)),
  );
  if (found.size < MIN_REQUIRED) {
    throw new PdfImportError(
      "출장보고서 PDF 양식이 아닙니다. 사내 시스템에서 저장한 출장보고서 PDF를 올려 주세요.",
    );
  }

  const values = group(lines);
  const warnings: PdfWarning[] = [];
  const warn = (field: string, message: string) =>
    warnings.push({ field, message });
  const text = (key: string) =>
    (values.get(key) ?? [])
      .map((ln) => ln.text)
      .join(" ")
      .trim();
  const pageRight = Math.max(...lines.map((ln) => ln.right));
  // 칸 오른쪽 끝: 오른쪽 열은 페이지 글자 끝, 나머지는 다음 열 시작 직전
  const columns = [
    ...new Set(
      lines
        .filter((ln) => {
          const k = norm(ln.text);
          return k in LABELS && !LABELS[k].startsWith("p.");
        })
        .map((ln) => pyRound(ln.left)),
    ),
  ].sort((a, b) => a - b);
  const columnRight = (fieldLines: Line[]) => {
    if (!fieldLines.length) return null;
    const left = fieldLines[0].left;
    const next = columns.filter((c) => c > left + 40);
    return next.length ? Math.min(...next) - 14 : pageRight;
  };

  const d: ParsedReport = {
    companions: [],
    billing: null,
    products: [],
    parts: [],
    region: null,
    sigungu: null,
  };
  const textKeys = [
    "requestOrgType",
    "requestOrg",
    "siteContact",
    "extraTrip",
    "authorName",
    "workType",
    "quoteType",
    "quote",
    "approver",
    "cc",
    "title",
  ] as const;
  for (const key of textKeys) if (values.has(key)) d[key] = text(key);
  if (!d.title) warn("title", "출장 목적을 읽지 못했습니다.");

  // 첫 줄 = 상태 배지 + 제목
  const first = lines[0].text;
  if (d.title && first.endsWith(d.title) && first !== d.title) {
    d.status = first.slice(0, -d.title.length).trim();
  }

  for (const key of ["tripStart", "tripEnd", "happyCallDate"] as const) {
    const raw = text(key);
    if (raw) {
      const parsed = isoDate(raw);
      d[key] = parsed;
      if (!parsed) warn(key, `날짜 "${raw}"를 읽을 수 없어 비워 두었습니다.`);
    }
  }
  if (!d.tripStart) {
    warn(
      "tripStart",
      "출장 시작일이 없습니다. 대시보드 집계 기준이므로 확인해 주세요.",
    );
  }
  const rawWritten = text("writtenAt");
  if (rawWritten) {
    d.writtenAt = writtenAt(rawWritten);
    if (!d.writtenAt) {
      warn(
        "writtenAt",
        `작성일 "${rawWritten}"를 읽을 수 없어 비워 두었습니다.`,
      );
    }
  }

  for (const key of MULTILINE) {
    const ls = values.get(key);
    if (!ls) continue;
    const { text: joined, soft } = joinParagraph(ls, columnRight(ls));
    d[key as "faultDescription"] = joined;
    if (soft) {
      warn(
        key,
        "화면 폭 때문에 나뉜 줄을 이어 붙였습니다. 문장이 자연스러운지 확인하세요.",
      );
    }
  }

  d.companions = (values.get("companions") ?? []).map((ln) => ln.text);

  const rawBilling = text("billing");
  d.billing = BILLING[rawBilling] ?? null;
  if (rawBilling && !d.billing) {
    warn(
      "billing",
      `비용청구 유무 "${rawBilling}"는 유상·무상이 아니어서 비워 두었습니다.`,
    );
  }

  // 제품 목록: 열마다 값이 같은 개수면 행으로 묶는다
  const cols = Object.fromEntries(
    (["modelName", "spec", "serialNo", "quantity"] as const).map((k) => [
      k,
      (values.get(`p.${k}`) ?? []).map((ln) => ln.text),
    ]),
  ) as Record<"modelName" | "spec" | "serialNo" | "quantity", string[]>;
  const lengths = Object.values(cols).map((v) => v.length);
  const count = Math.max(0, ...lengths);
  if (count && new Set(lengths.filter(Boolean)).size > 1) {
    warn(
      "products",
      "제품 목록의 열 개수가 서로 달라 행을 맞추지 못했을 수 있습니다. 확인하세요.",
    );
  }
  if (count > 1) {
    warn(
      "products",
      `제품이 ${count}개입니다. 행이 올바르게 나뉘었는지 확인하세요.`,
    );
  }
  for (let i = 0; i < count; i++) {
    const at = (k: keyof typeof cols) => cols[k][i] ?? "";
    const qtyRaw = at("quantity");
    const m = /^(\d+)\s*대?$/.exec(qtyRaw.trim());
    if (qtyRaw && !m) {
      warn("products", `수량 "${qtyRaw}"를 숫자로 읽지 못해 비워 두었습니다.`);
    }
    d.products.push({
      modelName: at("modelName"),
      spec: at("spec"),
      serialNo: at("serialNo"),
      quantity: m ? Number(m[1]) : null,
    });
  }

  const truncatedParts: Extracted["truncatedParts"] = [];
  (values.get("parts") ?? []).forEach((ln, index) => {
    const name = ln.text;
    d.parts.push({ name, quantity: null });
    if (name.endsWith("…") || name.endsWith("...")) {
      const prefix = name.replace(/[….]+$/, "").trimEnd();
      truncatedParts.push({
        index,
        name,
        suggestions: partNames.filter((n) => n.startsWith(prefix)),
      });
    }
  });
  if (truncatedParts.length) {
    warn(
      "parts",
      `부품명 ${truncatedParts.length}개가 PDF에서 잘려 있습니다("…"). 부품 목록에서 맞는 이름을 고르거나 확인하세요.`,
    );
  }

  warn(
    "region",
    "PDF에 출장지 주소가 없습니다. 지역(시·도·시·군·구)을 직접 선택하세요.",
  );
  return { data: d, warnings, truncatedParts };
}
