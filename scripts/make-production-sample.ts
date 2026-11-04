// 가상 제조내역 엑셀 만들기 (시연·업로드 확인용, 실제 기업 데이터 아님) — 친구 저장소 seed_production_demo.py 의 generate()·build_workbook() 그대로
// 실행: npm run make:production-sample -- [저장할 경로.xlsx]   (기본: ./가상_제조내역.xlsx)
// - 기업 양식과 같게 8~9행 머리글(B~Y), 10행부터 데이터, 시트 "2025(가상)"·"2026(가상)", 일련번호 "V25-0001", 수주번호 "V25001"
// - 만든 파일은 [엑셀 업로드] 화면에서 올려 보면 된다 (DB 에는 넣지 않음 — DB 가짜 데이터는 npm run seed:teams)
// - 난수는 파이썬 random 과 달라 친구 앱 파일과 값은 다르다 (규칙·양식만 같음)
import ExcelJS from "exceljs";

const YEARS = [2025, 2026] as const;
const SEED = 20261020;
const CLIENTS = [
  "새솔정수센터",
  "가람정수장",
  "아름정수장",
  "보람정수장",
  "하늘정수장",
  "솔빛정수장",
  "누리배수지",
  "자람배수지",
  "나래하수처리장",
  "사랑하수처리장",
  "푸른처리장",
  "마루정수센터",
  "라온발전소",
  "바다가스기지",
  "다온산업단지",
  "한별정유공장",
  "이음오일터미널",
  "가온화학단지",
];
const SELLERS = [
  "가상엔지니어링",
  "한빛가상설비",
  "누리가상상사",
  "다솜가상테크",
  "미르가상산업",
  "온새미가상기전",
];
const PROJECTS = [
  "유입수문 교체",
  "여과지 밸브 개량",
  "배수지 제어 개선",
  "취수장 설비 보강",
  "노후 밸브 교체",
];
const MODELS: [string, number][] = [
  ["01", 18],
  ["02", 32],
  ["03", 20],
  ["04", 18],
  ["05", 12],
];
const RPMS = ["24", "29", "36", "48"];
const POWERS = ["380/3/60", "220/1/60", "440/3/60"];
const BUSHES = ["301008", "250806", "401210", "200605", "351009"];
const MONTHLY_UNITS: Record<number, [number, number]> = {
  2025: [16, 28],
  2026: [20, 34],
};
const HEADER_8: Record<string, string> = {
  B: "일련번호",
  C: "모델명",
  D: "부시 가공",
  E: "rpm",
  F: "전원",
  G: "제조년월",
  H: "검사일자",
  I: "검사번호",
  J: "뉴토크 번호",
  L: "거래처 주문번호",
  M: "거래처",
  N: "최종발주처",
  O: "사업명",
  P: "납기일",
  Q: "출고일",
  R: "비고",
};
const HEADER_9: Record<string, string> = {
  J: "PO번호",
  K: "SO번호",
  S: "기타",
  U: "비고",
  V: "OPUN",
  W: "CLUN",
  X: "OPLO",
  Y: "CLLO",
};

// 고정 시드 난수 (mulberry32 — seed-teams.ts 와 같은 방식)
let a = SEED;
const random = () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(list: readonly T[]) =>
  list[Math.floor(random() * list.length)];
const weighted = (list: [string, number][]) => {
  let r = random() * list.reduce((n, [, w]) => n + w, 0);
  for (const [v, w] of list) if ((r -= w) < 0) return v;
  return list.at(-1)![0];
};
const utc = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const workday = (d: Date) => {
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = addDays(d, 1);
  return d;
};

type Row = Record<string, string | number | Date | null>;

function generate(today: Date) {
  const sheets = new Map<string, Row[]>();
  for (const year of YEARS) {
    const rows: Row[] = [];
    let serial = 0;
    let orderSeq = 0;
    for (let month = 1; month <= 12; month++) {
      const first = utc(year, month, 1);
      if (first > today) break;
      let units = int(...MONTHLY_UNITS[year]);
      while (units > 0) {
        orderSeq++;
        const yy = String(year % 100).padStart(2, "0");
        const orderNo = `V${yy}${String(orderSeq).padStart(3, "0")}`;
        const client = pick(CLIENTS);
        const seller = pick([...SELLERS, client]); // 직접 거래도 있음
        const project = random() < 0.4 ? pick(PROJECTS) : null;
        const model = weighted(MODELS);
        const rpm = pick(RPMS);
        const power = pick(POWERS);
        const bush = random() < 0.5 ? pick(BUSHES) : null;
        const explosion = random() < 0.1 ? "방폭" : null;
        const n = Math.min(units, pick([1, 1, 2, 2, 3, 4, 5, 6]));
        units -= n;
        const inspected = workday(addDays(first, int(0, 27)));
        if (inspected > today) break;
        const due = addDays(inspected, int(5, 14));
        const late = random() < 0.08;
        let shipped: Date | null = late
          ? addDays(due, int(1, 6))
          : addDays(due, -int(0, 4));
        if (shipped < inspected) shipped = inspected;
        if (shipped > today || random() < 0.02) shipped = null; // 아직 출고 전(또는 출고일 미기재)
        for (let k = 0; k < n; k++) {
          serial++;
          rows.push({
            B: `V${yy}-${String(serial).padStart(4, "0")}`,
            C: model,
            D: bush,
            E: rpm,
            F: power,
            G: inspected,
            H: inspected,
            I: String(serial).padStart(3, "0"),
            J: orderNo,
            M: seller,
            N: client,
            O: project,
            P: due,
            Q: shipped,
            R: explosion,
            V: int(1650, 1950),
            W: int(1900, 2060),
            X: int(1250, 1620),
            Y: int(2200, 2450),
          });
        }
      }
    }
    sheets.set(`${year}(가상)`, rows);
  }
  return sheets;
}

async function main() {
  const out =
    process.argv.slice(2).find((x) => !x.startsWith("--")) ??
    "가상_제조내역.xlsx";
  const kst = new Date(Date.now() + 9 * 3600_000);
  const today = utc(
    kst.getUTCFullYear(),
    kst.getUTCMonth() + 1,
    kst.getUTCDate(),
  );
  const wb = new ExcelJS.Workbook();
  let total = 0;
  for (const [name, rows] of generate(today)) {
    const ws = wb.addWorksheet(name);
    ws.getCell("B1").value =
      "** 가상 데이터(개발·시연용, 실제 기업 데이터 아님) — npm run make:production-sample 로 생성";
    ws.getCell("B7").value = `${name.slice(0, 4)}년 `;
    for (const [col, text] of Object.entries(HEADER_8))
      ws.getCell(`${col}8`).value = text;
    for (const [col, text] of Object.entries(HEADER_9))
      ws.getCell(`${col}9`).value = text;
    for (const col of "BCDEFGHILMNOPQR") ws.mergeCells(`${col}8:${col}9`);
    ws.mergeCells("J8:K8");
    rows.forEach((row, i) => {
      ws.getCell(`A${i + 10}`).value = i + 1;
      for (const [col, v] of Object.entries(row))
        if (v !== null) ws.getCell(`${col}${i + 10}`).value = v;
    });
    total += rows.length;
  }
  await wb.xlsx.writeFile(out);
  console.log(
    `가상 제조내역 ${total}행을 ${out} 에 만들었습니다. [엑셀 업로드] 화면에서 올려 확인하세요.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
