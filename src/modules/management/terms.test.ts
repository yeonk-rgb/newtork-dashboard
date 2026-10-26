import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { accessiblePages } from "@/shared/auth/access";
import { FAKE_USERS } from "@/shared/auth/testing/fake-users";

import { HISTORY_SCREENS } from "./history/labels";
import { AR_STATUS_LABEL } from "./ledger/labels";
import { TERMS } from "./terms";

describe("화면 단어 표 (2026-10-26 담당자님 자료 단어)", () => {
  it("사이드바(shared — 단어 표를 가져올 수 없음)도 같은 글자", () => {
    const labels = accessiblePages(FAKE_USERS.admin)
      .find((p) => p.href === "/management")
      ?.children?.map((c) => c.label);
    expect(labels).toContain(TERMS.ledger);
    expect(labels).toContain(TERMS.itemReceivables);
  });

  it("외상매출금 상태·변경 이력 화면 이름은 단어 표에서", () => {
    expect(Object.values(AR_STATUS_LABEL)).toEqual([
      "장기 미수금",
      "당월 수금",
      "당월 수금예정",
    ]);
    expect(HISTORY_SCREENS.map((s) => s.label)).toEqual(
      expect.arrayContaining([
        "경영지원 관리",
        "경영지원 관리 엑셀 이관",
        "경영지원 관리 엑셀 다운로드",
        "미수금 건별 기록",
      ]),
    );
  });

  // 화면·엑셀·AI 문장에 옛 단어가 다시 들어오지 않게 — 주석은 빼고 코드(문자열)만 본다
  // 남겨 두는 곳: 엑셀 메모 판별("장기미수금"·"수금예정" — 고객사 원본 글자), 예전 시트 이름 테스트
  it("src 의 코드(주석 제외)에 옛 단어가 없다", () => {
    const OLD =
      /채권·채무|장기미수(?!금)|당월\s?수금완료|당월수금예정|미수금\(건별|미수금 관리|건별 참고|자금수지|미수 아님/;
    const root = join(process.cwd(), "src");
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "generated" && e.name !== "__snapshots__") walk(p);
        } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
          const code = readFileSync(p, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "")
            .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
          code.split("\n").forEach((line, i) => {
            if (OLD.test(line)) found.push(`${p}:${i + 1}: ${line.trim()}`);
          });
        }
      }
    };
    walk(root);
    expect(found).toEqual([]);
  });
});
