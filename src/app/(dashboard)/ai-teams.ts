// AI 카드에 넘기는 생산·서비스 연결 (메인·경영지원 상세 공용)
import "server-only";

import type { TeamAiHooks } from "@/modules/management";

import { generateAiComment } from "./ai-actions";
import { loadTeamAiFacts } from "./team-ai-facts";

export const aiTeams: TeamAiHooks = {
  loadTeams: loadTeamAiFacts,
  generateAction: generateAiComment,
};
