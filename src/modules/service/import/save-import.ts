// 출장보고서 엑셀 가져오기 — 중복 확인·저장 (서버 전용, npm run import:service 가 부름)
// 친구 import_service_xlsx.py 그대로: 같은 메모(파일명·번호)면 건너뜀, 같은 출장 시작일·요청처·작성자 + 일련번호가 겹치면 건너뜀,
// 오류가 한 건이라도 있으면 아무것도 저장하지 않음, 기본은 확인만(--save 로 저장). 숨긴 보고서도 중복으로 본다
import "server-only";

import { prisma } from "@/shared/db/client";

import { createReportIn } from "../reports/save-report";
import type { ImportRow } from "./parse-import";

/** 스크립트로 넣은 보고서의 작성자 id (사람 계정과 연결하지 않음) */
export const IMPORT_ACTOR = {
  id: "import-service-xlsx",
  loginId: "import:service",
};

export async function planImport(rows: ImportRow[]) {
  const save: ImportRow[] = [];
  const skipped: string[] = [];
  for (const r of rows) {
    if (await prisma.svcReport.count({ where: { note: r.marker } })) {
      skipped.push(`번호 ${r.no}: 이미 가져온 행`);
      continue;
    }
    if (
      r.serials.length &&
      (await prisma.svcReport.count({
        where: {
          tripStart: r.values.tripStart
            ? new Date(`${r.values.tripStart}T00:00:00Z`)
            : null,
          requestOrg: r.values.requestOrg,
          authorName: r.values.authorName,
          products: { some: { serialNo: { in: r.serials } } },
        },
      }))
    ) {
      skipped.push(
        `번호 ${r.no}: 같은 출장일·요청처·작성자·일련번호 보고서가 이미 있음`,
      );
      continue;
    }
    save.push(r);
  }
  return { save, skipped };
}

export async function saveImport(
  rows: ImportRow[],
  fileName: string,
  now: Date,
) {
  await prisma.$transaction(
    async (tx) => {
      for (const r of rows) {
        await createReportIn(
          tx,
          r.values,
          IMPORT_ACTOR,
          now,
          { fileName, excelRow: r.excelRow },
          "service-import",
        );
      }
    },
    { timeout: 120_000 },
  );
}
