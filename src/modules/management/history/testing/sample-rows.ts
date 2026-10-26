// 변경 이력 엑셀 테스트용 가짜 기록 (*.test.ts 와 비교 스크립트에서만)
import type { HistoryRow } from "../labels";

export const SAMPLE_HISTORY_ROWS: HistoryRow[] = [
  {
    id: "h1",
    occurredAt: "2026-10-25 13:45",
    actor: "윤경영(mgmt_member)",
    actorName: "윤경영",
    actorLoginId: "mgmt_member",
    screen: "경영지원 관리",
    action: "수정",
    target: "가나상사(가상) · 2026-10 외상매출금",
    lines: ["잔액: 12,500,000원 → 13,000,000원", "적요: (없음) → 10/15"],
  },
  {
    id: "h2",
    occurredAt: "2026-10-26 01:47",
    actor: "관리자(admin)",
    actorName: "관리자",
    actorLoginId: "admin",
    screen: "월별 리포트 엑셀 다운로드",
    action: "엑셀 다운로드",
    target: "월별 리포트 엑셀 다운로드 · 2026-Q3",
    lines: ["2026-Q3 · 시트 4장 · 경영지원_리포트_2026-Q3.xlsx"],
  },
  {
    id: "h3",
    occurredAt: "2026-10-26 02:10",
    actor: "(삭제된 계정)(old_user)",
    actorName: null,
    actorLoginId: "old_user",
    screen: "미수금 건별 기록",
    action: "숨김",
    target: "자차석유(가상) · 2026-09-30 발생",
    lines: [],
  },
];
