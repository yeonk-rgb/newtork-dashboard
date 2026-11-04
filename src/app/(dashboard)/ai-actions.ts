"use server";
// AI 분석 [분석하기] — 생산·서비스 숫자는 브라우저에서 받지 않고 서버에서 다시 만든다 (메인·경영지원 상세 공용)
import { generateAiCommentWithTeams } from "@/modules/management";

import { loadTeamAiFacts } from "./team-ai-facts";

export async function generateAiComment(raw: unknown) {
  return generateAiCommentWithTeams(raw, loadTeamAiFacts);
}
