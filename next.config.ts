import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 채권·채무 엑셀 다운로드는 실행 중에 고객사 원본 양식을 읽어 서식을 맞춘다 — 배포 결과물(서버 trace)에 꼭 포함
  outputFileTracingIncludes: {
    "/api/management/ledger/export": [
      "./src/modules/management/ledger/export/ledger-template.xlsx",
    ],
  },
  experimental: {
    // 엑셀 업로드(Server Action으로 파일 전송) — 기본 1MB → 10MB
    serverActions: { bodySizeLimit: "10mb" },
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
