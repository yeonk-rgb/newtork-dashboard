// UTC 로 저장된 시각 → 한국 시간 "2026-10-19 14:13" (팀 공통 표시용)
export const kstDateTime = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
