// 도넛 카드 데이터 계산 (순수 함수 — 화면·테스트 공용): 비율, 목록 순서, CSV
export type DonutSlice = {
  key: string;
  label: string;
  /** 정수 문자열 (금액은 원 단위) — 조각 크기 */
  value: string;
  color: string;
  /** 목록 오른쪽 작은 값 (예: "3건", "30대") */
  extra?: string;
  /** 조각은 그리지만 목록·표에서 "남은 목표"처럼 흐리게 */
  muted?: boolean;
  /** 목록 이름 옆 작은 글씨 (예: 기타 "(광고선전비·접대비 등)") */
  hint?: string;
};

export type DonutRow = DonutSlice & {
  /** 비율 (0~1+) — ratioBase 가 있으면 그것 대비, 없으면 합계 대비 */
  ratio: number;
};

/**
 * 비율 계산
 * @param ratioBase 비율의 분모 (예: 목표 달성 도넛은 목표 금액 — 초과분이 100%를 넘을 수 있음). 없으면 합계
 */
export function donutRows(
  slices: DonutSlice[],
  ratioBase?: string,
): DonutRow[] {
  const total = slices.reduce((n, s) => n + BigInt(s.value), 0n);
  const base = ratioBase !== undefined ? BigInt(ratioBase) : total;
  return slices.map((s) => ({
    ...s,
    ratio: base === 0n ? 0 : Number(BigInt(s.value)) / Number(base),
  }));
}

export const donutPct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

/** 목록 순서: 조각 순서 그대로 / 값 큰 순 */
export function listRows(
  rows: DonutRow[],
  order: "slice" | "value",
): DonutRow[] {
  if (order === "slice") return rows;
  return [...rows].sort((a, b) => {
    const d = BigInt(b.value) - BigInt(a.value);
    return d === 0n ? 0 : d > 0n ? 1 : -1;
  });
}

/** CSV (엑셀에서 한글이 깨지지 않게 BOM 포함). 금액은 원 단위 정수 그대로 */
export function donutCsv(
  rows: DonutRow[],
  valueHeader: string,
  extraHeader?: string,
): string {
  const escape = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const header = [
    "항목",
    valueHeader,
    "비율(%)",
    ...(extraHeader ? [extraHeader] : []),
  ];
  const lines = rows.map((r) =>
    [
      escape(r.label),
      r.value,
      (r.ratio * 100).toFixed(1),
      ...(extraHeader ? [escape(r.extra ?? "")] : []),
    ].join(","),
  );
  return `﻿${[header.join(","), ...lines].join("\r\n")}\r\n`;
}
