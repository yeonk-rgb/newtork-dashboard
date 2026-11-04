// 출장보고서 PDF → 줄 목록 (서버 전용) — 친구 저장소 backend/service/pdf_import.py read_lines() 그대로
// 친구 앱과 같은 PDFium(크롬 PDF 엔진)을 WASM 으로 쓴다: 이 양식은 숫자를 특수 글꼴로 그려 pdf.js 로는 숫자가 사용자 영역 글자로 깨진다
// 글자마다 FPDFText_GetText(1글자) + 글자 상자, \r·\n 에서 줄을 나눈다. 이 PDFium 판은 띄어쓰기를 NBSP(U+00A0)로 주므로 보통 공백으로 바꾼다
// (2026-11-03 샘플로 확인: 친구 앱과 줄 수·위치 모두 같고, parse() 결과 24개 항목 모두 같음)
import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { init } from "@embedpdf/pdfium";

import { PdfImportError, type Line } from "./parse";

type Pdfium = Awaited<ReturnType<typeof init>>;
let ready: Promise<Pdfium> | null = null;

async function pdfium() {
  ready ??= (async () => {
    // require.resolve 로 찾으면 Turbopack 이 .wasm 을 모듈로 묶으려다 실패한다 → 파일로 읽는다 (next.config 에서 배포 결과물에 포함)
    const wasmBinary = await readFile(
      path.join(
        process.cwd(),
        "node_modules/@embedpdf/pdfium/dist/pdfium.wasm",
      ),
    );
    // thisProgram: PDFium 이 환경변수를 읽을 때 실행 파일 경로(프로젝트 폴더 "뉴토크코리아")를 넣는데,
    // emscripten 은 ASCII 가 아니면 assert 로 멈춘다 → 고정 이름 (2026-11-03 dev 서버에서 확인)
    const m = await init({ wasmBinary, thisProgram: "pdfium" });
    m.PDFiumExt_Init();
    return m;
  })();
  return ready;
}

export async function readLines(data: Uint8Array): Promise<Line[]> {
  const m = await pdfium();
  const P = m.pdfium;
  const buf = P.wasmExports.malloc(data.length);
  const box = P.wasmExports.malloc(32);
  const ch1 = P.wasmExports.malloc(16);
  const lines: Line[] = [];
  try {
    // emscripten HEAPU8 는 이 패키지 타입에 빠져 있음
    (P as unknown as { HEAPU8: Uint8Array }).HEAPU8.set(data, buf);
    const doc = m.FPDF_LoadMemDocument(buf, data.length, "");
    if (!doc) {
      throw new PdfImportError(
        "PDF 파일을 열 수 없습니다. 손상되었거나 암호가 걸린 파일인지 확인하세요.",
      );
    }
    try {
      const pages = m.FPDF_GetPageCount(doc);
      for (let p = 0; p < pages; p++) {
        const page = m.FPDF_LoadPage(doc, p);
        const tp = m.FPDFText_LoadPage(page);
        let text = "";
        let left: number | null = null;
        let right: number | null = null;
        const flush = () => {
          if (text.trim()) {
            lines.push({
              text: text.replace(/ /g, " ").replace(/ {2,}/g, " ").trim(),
              left: left ?? 0,
              right: right ?? 0,
            });
          }
          text = "";
          left = right = null;
        };
        const n = m.FPDFText_CountChars(tp);
        for (let i = 0; i < n; i++) {
          const ch =
            m.FPDFText_GetText(tp, i, 1, ch1) > 1 ? P.UTF16ToString(ch1) : "";
          if (ch === "\r" || ch === "\n") {
            if (ch === "\n" || text) flush();
            continue;
          }
          text += ch;
          if (ch.trim()) {
            m.FPDFText_GetCharBox(tp, i, box, box + 8, box + 16, box + 24);
            const l = P.getValue(box, "double");
            const r = P.getValue(box + 8, "double");
            left = left === null ? l : Math.min(left, l);
            right = right === null ? r : Math.max(right, r);
          }
        }
        flush();
        m.FPDFText_ClosePage(tp);
        m.FPDF_ClosePage(page);
      }
    } finally {
      m.FPDF_CloseDocument(doc);
    }
  } finally {
    P.wasmExports.free(buf);
    P.wasmExports.free(box);
    P.wasmExports.free(ch1);
  }
  return lines;
}
