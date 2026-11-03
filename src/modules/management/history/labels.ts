// 변경 이력 화면 표기 (순수 함수) — 화면 이름·동작 이름·바뀐 내용·추가 정보를 고객이 읽는 한글 문장으로
// npm run audit:recent 는 개발용(JSON 그대로)이고, 화면·엑셀은 이 파일의 표기만 쓴다
import {
  AUDIT_ACTION_LABEL,
  type AuditAction,
  type AuditArea,
  type AuditChange,
} from "@/shared/audit/types";
import { TERMS } from "../terms";

/** 기록하는 화면 — area "admin" 화면은 관리자(대표)만 고를 수 있다 */
export const HISTORY_SCREENS: {
  key: string;
  label: string;
  area: AuditArea;
}[] = [
  { key: "entry", label: "월간 입력", area: "management" },
  { key: "targets", label: "목표 설정", area: "management" },
  { key: "expense-categories", label: "지출 항목", area: "management" },
  { key: "receivables", label: TERMS.itemReceivables, area: "management" },
  { key: "ledger", label: TERMS.ledger, area: "management" },
  {
    key: "ledger-copy",
    label: `${TERMS.ledger} 지난달 불러오기`,
    area: "management",
  },
  {
    key: "ledger-import",
    label: `${TERMS.ledger} 엑셀 이관`,
    area: "management",
  },
  {
    key: "ledger-export",
    label: `${TERMS.ledger} 엑셀 다운로드`,
    area: "management",
  },
  { key: "entry-export", label: "월간 입력 엑셀 다운로드", area: "management" },
  {
    key: "targets-export",
    label: "목표 대비 실적 엑셀 다운로드",
    area: "management",
  },
  {
    key: "receivables-export",
    label: "미수금 엑셀 다운로드",
    area: "management",
  },
  {
    key: "report-export",
    label: "월별 리포트 엑셀 다운로드",
    area: "management",
  },
  { key: "upload", label: "엑셀 업로드", area: "management" },
  // 생산 (2026-11-03 통합 2단계)
  {
    key: "production-upload",
    label: "생산 · 제조내역 엑셀 업로드",
    area: "production",
  },
  { key: "production-records", label: "생산 · 제조내역", area: "production" },
  {
    key: "production-categories",
    label: "생산 · 사업구분 지정",
    area: "production",
  },
  { key: "admin-users", label: "관리자(대표) · 계정 관리", area: "admin" },
  {
    key: "history-export",
    label: "관리자(대표) · 변경 이력 내려받기",
    area: "admin",
  },
];

const SCREEN_LABEL = new Map(HISTORY_SCREENS.map((s) => [s.key, s.label]));

/** 화면 이름 (모르는 화면 — 다른 팀 저장소를 합친 뒤 등 — 은 저장된 이름 그대로) */
export function screenLabel(screen: string): string {
  return SCREEN_LABEL.get(screen) ?? screen;
}

export function actionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action as AuditAction] ?? action;
}

const EMPTY = "(없음)";

/** 바뀐 칸 한 줄씩 — "잔액: 12,500,000원 → 13,000,000원", 빈 값은 "(없음)" */
export function changeLines(changes: unknown): string[] {
  if (!Array.isArray(changes)) return [];
  return (changes as Partial<AuditChange>[])
    .filter((c) => typeof c?.label === "string")
    .map((c) => `${c.label}: ${c.before ?? EMPTY} → ${c.after ?? EMPTY}`);
}

// meta 는 Json 이라 칸마다 형식을 확인하고 읽는다 (없거나 형식이 다르면 그 칸은 빼고 문장을 만든다)
type Meta = Record<string, unknown>;
const str = (m: Meta, k: string) =>
  typeof m[k] === "string" && m[k] !== "" ? (m[k] as string) : null;
const num = (m: Meta, k: string) =>
  typeof m[k] === "number" ? (m[k] as number) : null;
const list = (m: Meta, k: string) =>
  Array.isArray(m[k]) ? (m[k] as unknown[]).map(String) : null;
const join = (parts: (string | null | false)[]) =>
  parts.filter((p): p is string => !!p).join(" · ") || null;

/**
 * 추가 정보(meta)를 한 줄 문장으로 — JSON 은 화면에 그대로 보여 주지 않는다
 * 예) 다운로드 "2026-10 · 시트 1장 · 6행 · 경영지원_관리_2026-10.xlsx"
 *     이관 "2026-08 · 추가 · 16행 저장 · 숨긴 기존 행 0 · ledger-sample.xlsx"
 */
export function metaSummary(
  screen: string,
  action: string,
  meta: unknown,
): string | null {
  if (action === "PASSWORD_RESET") return "비밀번호를 초기화함";
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Meta;
  const count = (k: string, unit: string) => {
    const n = num(m, k);
    return n === null ? null : `${n.toLocaleString("ko-KR")}${unit}`;
  };

  if (
    screen === "ledger-export" ||
    screen === "entry-export" ||
    screen === "targets-export" ||
    screen === "receivables-export" ||
    screen === "report-export"
  ) {
    return join([
      str(m, "period"),
      num(m, "sheetCount") !== null && `시트 ${count("sheetCount", "장")}`,
      count("rows", "행"),
      str(m, "fileName"),
    ]);
  }
  if (screen === "ledger-import") {
    return join([
      str(m, "month"),
      str(m, "mode"),
      num(m, "savedRows") !== null && `${count("savedRows", "행")} 저장`,
      num(m, "hiddenRows") !== null &&
        `숨긴 기존 행 ${count("hiddenRows", "")}`,
      !!num(m, "excludedRows") && `제외 ${count("excludedRows", "행")}`,
      str(m, "fileName"),
    ]);
  }
  if (screen === "ledger-copy") {
    return join([
      str(m, "from") && `${str(m, "from")} → ${str(m, "month")}`,
      num(m, "savedRows") !== null && `${count("savedRows", "행")} 저장`,
      !!num(m, "collectedRows") &&
        `${TERMS.collected} ${count("collectedRows", "행")} ${str(m, "includeCollected") ?? ""}`.trim(),
    ]);
  }
  if (screen === "upload") {
    const years = list(m, "targetYears");
    const months = list(m, "months");
    return join([
      num(m, "savedRows") !== null && `${count("savedRows", "행")} 저장`,
      !!years?.length && `목표 ${years.map((y) => `${y}년`).join(", ")}`,
      !!months?.length && `월별 실적 ${months.join(", ")}`,
      list(m, "fileNames")?.join(", ") ?? null,
    ]);
  }
  if (screen === "production-upload") {
    return join([
      num(m, "created") !== null && `새로 저장 ${count("created", "행")}`,
      num(m, "overwritten") !== null && `덮어씀 ${count("overwritten", "행")}`,
      !!num(m, "kept") && `덮어쓰지 않음 ${count("kept", "행")}`,
      !!num(m, "hidden") && `숨긴 행과 같음 ${count("hidden", "행")}`,
      str(m, "fileName"),
    ]);
  }
  if (screen === "history-export") {
    const from = str(m, "from");
    const to = str(m, "to");
    return join([
      from && to && `${from} ~ ${to}`,
      count("rows", "건"),
      str(m, "fileName"),
    ]);
  }
  return null;
}

/** 일시 — 한국 시간 "YYYY-MM-DD HH:mm" */
export function formatKstDateTime(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16).replace("T", " ");
}

/** 사람 — "이름(아이디)", 사용자 표에 없으면 아이디만 */
export function actorText(name: string | null, loginId: string): string {
  return name ? `${name}(${loginId})` : loginId;
}

/** 화면·엑셀에 쓰는 기록 한 줄 (직렬화 가능한 글자만) */
export type HistoryRow = {
  id: string;
  /** "2026-10-25 13:45" (한국 시간) */
  occurredAt: string;
  /** "윤경영(mgmt_member)" */
  actor: string;
  actorName: string | null;
  actorLoginId: string;
  screen: string;
  action: string;
  target: string;
  /** 바뀐 칸 한 줄씩 + 추가 정보 문장 */
  lines: string[];
};

export type AuditLogRecord = {
  id: string;
  occurredAt: Date;
  actorId: string;
  actorLoginId: string;
  screen: string;
  action: string;
  targetLabel: string;
  changes: unknown;
  meta: unknown;
};

export function presentHistoryRow(
  r: AuditLogRecord,
  nameOf: (actorId: string) => string | null,
): HistoryRow {
  const name = nameOf(r.actorId);
  const summary = metaSummary(r.screen, r.action, r.meta);
  return {
    id: r.id,
    occurredAt: formatKstDateTime(r.occurredAt),
    actor: actorText(name, r.actorLoginId),
    actorName: name,
    actorLoginId: r.actorLoginId,
    screen: screenLabel(r.screen),
    action: actionLabel(r.action),
    target: r.targetLabel,
    lines: [...changeLines(r.changes), ...(summary ? [summary] : [])],
  };
}
