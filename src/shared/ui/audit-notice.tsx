// 입력·수정 화면 제목 아래 한 줄 안내 — 저장·확정·삭제 등은 변경 이력(audit_log)에 남는다 (2026-10-26 결정, 05-30·31)
export const AUDIT_NOTICE = "작업 내용은 변경 이력에 기록됩니다.";

export function AuditNotice() {
  return <p className="mt-1 text-xs text-muted-foreground">{AUDIT_NOTICE}</p>;
}
