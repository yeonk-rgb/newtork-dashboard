import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // 출장보고서 PDF 글자 읽기 — PDFium WASM 을 node_modules 에서 그대로 읽는다 (서비스 pdf/read-lines.ts)
  serverExternalPackages: ["@embedpdf/pdfium"],
  partialPrefetching: true,
  // 경영지원 엑셀 다운로드는 실행 중에 고객사 원본 양식을 읽어 서식을 맞춘다 — 배포 결과물(서버 trace)에 꼭 포함
  outputFileTracingIncludes: {
    "/api/management/ledger/export": [
      "./src/modules/management/ledger/export/ledger-template.xlsx",
    ],
    "/api/management/export": [
      "./src/modules/management/ledger/export/ledger-template.xlsx",
    ],
    "/api/management/history/export": [
      "./src/modules/management/ledger/export/ledger-template.xlsx",
    ],
    "/service/reports/new": [
      "./node_modules/@embedpdf/pdfium/dist/pdfium.wasm",
    ],
  },
  experimental: {
    // 엑셀 업로드·출장보고서 첨부(Server Action으로 파일 전송) — 기본 1MB → 21MB (첨부는 파일당 20MB, 친구 앱과 같음)
    serverActions: { bodySizeLimit: "21mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
