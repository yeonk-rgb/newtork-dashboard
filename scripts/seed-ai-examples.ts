// 대시보드 예시 AI 분석 넣기·지우기 (실제 API 호출 없음 — 시드 데이터로 서버가 계산한 숫자로 문장을 만든다)
// 실행: npm run seed:ai-examples              넣기 (여러 번 실행해도 중복 없음)
//       npm run seed:ai-examples -- --remove   예시만 지우기 (다른 분석 기록은 그대로)
//       npm run seed:ai-examples:if-enabled    배포 빌드용 — SEED_AI_EXAMPLES=true 일 때만 넣고, 확정 데이터가 없는 분기는 건너뜀 (빌드를 멈추지 않음)
// ⚠️ 고객사 실제 데이터를 넣기 전(05-19번 답변 후)에는 --remove 로 지운다 (docs/integration-notes.md)
import "dotenv/config";

import {
  loadSummaryInput,
  todayKst,
} from "@/modules/management/data/load-summary-input";
import {
  buildExampleRow,
  removeExamples,
  upsertExamples,
} from "@/modules/management/ai/example-seed";
import { EXAMPLE_QUARTERS } from "@/modules/management/ai/examples";
import { computeManagementSummary } from "@/modules/management/metrics/summary";
import { prisma } from "@/shared/db/client";

async function main() {
  if (process.argv.includes("--remove")) {
    const count = await removeExamples(prisma.aiComment);
    console.log(`예시 분석 ${count}건을 지웠습니다. (다른 분석 기록은 그대로)`);
    return;
  }

  const ifEnabled = process.argv.includes("--if-enabled");
  if (ifEnabled && process.env.SEED_AI_EXAMPLES !== "true") {
    console.log("예시 분석 건너뜀 (SEED_AI_EXAMPLES 가 true 가 아님)");
    return;
  }

  const today = todayKst(new Date());
  const rows = [];
  for (const { quarter, situation } of EXAMPLE_QUARTERS) {
    const summary = computeManagementSummary(
      await loadSummaryInput(quarter, today),
    );
    if (!summary.confirmation.hasData) {
      if (ifEnabled) {
        console.log(`- ${summary.label}: 확정 데이터가 없어 건너뜀`);
        continue;
      }
      throw new Error(
        `${summary.label}에 확정 데이터가 없습니다. 먼저 npm run db:seed`,
      );
    }
    rows.push(buildExampleRow(summary, quarter));
    console.log(`- ${summary.label}: ${situation}`);
  }
  await upsertExamples(prisma.aiComment, rows);
  console.log(
    `예시 분석 ${rows.length}건을 넣었습니다. 대시보드에서 위 분기를 고르면 "예시"로 보입니다.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
